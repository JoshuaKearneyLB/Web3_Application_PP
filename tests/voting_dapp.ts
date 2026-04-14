import * as anchor from "@coral-xyz/anchor";
import { SystemProgram, PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { assert } from "chai";
import { createHash } from "crypto";
import { VotingDapp } from "../target/types/voting_dapp";

function sha256(data: string): Buffer {
  return createHash("sha256").update(data).digest();
}

describe("voting_dapp — full election lifecycle", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.votingDapp as anchor.Program<VotingDapp>;
  const admin = provider.wallet;
  const connection = provider.connection;

  // Generate voter and impostor keypairs
  const voter = Keypair.generate();
  const voter2 = Keypair.generate(); // for Sybil test
  const impostor = Keypair.generate(); // non-admin wallet

  // Shared state across tests
  const pollName = "Test Election";
  const studentId = "STU-001";
  const salt = createHash("sha256").update("test-salt").digest().toString("hex");
  let pollPda: PublicKey;
  let credentialPda: PublicKey;
  let identityPda: PublicKey;
  let voterPda: PublicKey;
  let alicePda: PublicKey;
  let bobPda: PublicKey;

  // Airdrop SOL to test wallets before all tests
  before(async () => {
    // Airdrop to voter
    const sig1 = await connection.requestAirdrop(voter.publicKey, 2 * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig1, "confirmed");

    // Airdrop to voter2
    const sig2 = await connection.requestAirdrop(voter2.publicKey, 2 * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig2, "confirmed");

    // Airdrop to impostor
    const sig3 = await connection.requestAirdrop(impostor.publicKey, 2 * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig3, "confirmed");

    // Derive PDAs used across tests
    [pollPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("poll"), Buffer.from(pollName)],
      program.programId
    );

    [credentialPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("credential"), voter.publicKey.toBuffer()],
      program.programId
    );

    const identityHash = sha256(studentId + salt);
    [identityPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("identity"), identityHash],
      program.programId
    );

    [voterPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("anchor"), voter.publicKey.toBuffer()],
      program.programId
    );

    [alicePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("candidate"), pollPda.toBuffer(), Buffer.from("Alice")],
      program.programId
    );

    [bobPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("candidate"), pollPda.toBuffer(), Buffer.from("Bob")],
      program.programId
    );
  });

  // ==================== CREDENTIAL TESTS ====================

  it("1. Issue credential to voter", async () => {
    const vcJson = JSON.stringify({
      "@context": ["https://www.w3.org/2018/credentials/v1"],
      type: ["VerifiableCredential", "VoterEligibilityCredential"],
      issuer: `did:sol:${admin.publicKey.toBase58()}`,
      issuanceDate: new Date().toISOString(),
      credentialSubject: {
        id: `did:sol:${voter.publicKey.toBase58()}`,
        eligibility: { type: "VoterEligibility", eligible: true },
      },
    });

    const credentialHash = sha256(vcJson);
    const identityHash = sha256(studentId + salt);

    await program.methods
      .issueCredential(credentialHash, identityHash)
      .accounts({
        credential: credentialPda,
        identity: identityPda,
        subject: voter.publicKey,
        admin: admin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const cred = await program.account.credential.fetch(credentialPda);
    assert.strictEqual(cred.issuer.toBase58(), admin.publicKey.toBase58());
    assert.strictEqual(cred.subject.toBase58(), voter.publicKey.toBase58());
    assert.strictEqual(cred.isRevoked, false);
  });

  it("2. Reject duplicate identity (Sybil protection)", async () => {
    // Same student ID, different wallet → same identity hash → PDA already exists
    const identityHash = sha256(studentId + salt);

    const [cred2Pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("credential"), voter2.publicKey.toBuffer()],
      program.programId
    );
    // Identity PDA is the same because same studentId + salt
    const [identity2Pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("identity"), identityHash],
      program.programId
    );

    const vcJson = JSON.stringify({
      "@context": ["https://www.w3.org/2018/credentials/v1"],
      type: ["VerifiableCredential"],
      issuer: `did:sol:${admin.publicKey.toBase58()}`,
      credentialSubject: { id: `did:sol:${voter2.publicKey.toBase58()}` },
    });

    try {
      await program.methods
        .issueCredential(sha256(vcJson), identityHash)
        .accounts({
          credential: cred2Pda,
          identity: identity2Pda,
          subject: voter2.publicKey,
          admin: admin.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      assert.fail("Should have failed — duplicate identity");
    } catch (err) {
      // Identity PDA already exists — init fails
      assert.ok(err.toString().includes("already in use") || err.toString().includes("custom program error"));
    }
  });

  // ==================== REGISTRATION TESTS ====================

  it("3. Register voter (initialize with DID + embedded VC)", async () => {
    const did = `did:sol:${voter.publicKey.toBase58()}`;
    const docUri = "http://localhost:5173/did.json";

    const cred = await program.account.credential.fetch(credentialPda);

    const doc = JSON.stringify({
      id: did,
      verificationMethod: [{ id: `${did}#key-1`, type: "Ed25519VerificationKey2018", publicKeyBase58: voter.publicKey.toBase58() }],
      authentication: [`${did}#key-1`],
      verifiableCredential: [{
        "@context": ["https://www.w3.org/2018/credentials/v1"],
        type: ["VerifiableCredential", "VoterEligibilityCredential"],
        issuer: `did:sol:${cred.issuer.toBase58()}`,
        credentialSubject: { id: did, eligible: true },
      }],
    });

    const docHash = sha256(doc);

    await program.methods
      .initialize(did, docUri, docHash)
      .accounts({
        voter: voterPda,
        credential: credentialPda,
        authority: voter.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([voter])
      .rpc();

    const voterAccount = await program.account.voter.fetch(voterPda);
    assert.strictEqual(voterAccount.did, did);
    assert.strictEqual(voterAccount.docUri, docUri);
    assert.deepStrictEqual(Buffer.from(voterAccount.docHash), docHash);
    assert.strictEqual(voterAccount.authority.toBase58(), voter.publicKey.toBase58());
  });

  it("4. Reject registration without credential", async () => {
    // impostor has no credential PDA
    const [impostorVoterPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("anchor"), impostor.publicKey.toBuffer()],
      program.programId
    );
    const [impostorCredPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("credential"), impostor.publicKey.toBuffer()],
      program.programId
    );

    const did = `did:sol:${impostor.publicKey.toBase58()}`;
    const docHash = sha256(JSON.stringify({ id: did }));

    try {
      await program.methods
        .initialize(did, "http://example.com", docHash)
        .accounts({
          voter: impostorVoterPda,
          credential: impostorCredPda,
          authority: impostor.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([impostor])
        .rpc();
      assert.fail("Should have failed — no credential");
    } catch (err) {
      // Credential PDA doesn't exist → account deserialization fails
      assert.ok(err.toString().includes("AccountNotInitialized") || err.toString().includes("does not exist"));
    }
  });

  // ==================== POLL TESTS ====================

  it("5. Create poll", async () => {
    await program.methods
      .createPoll(pollName)
      .accounts({
        poll: pollPda,
        authority: admin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const poll = await program.account.poll.fetch(pollPda);
    assert.strictEqual(poll.name, pollName);
    assert.strictEqual(poll.admin.toBase58(), admin.publicKey.toBase58());
    assert.strictEqual(poll.isActive, false);
  });

  it("6. Reject non-admin poll creation", async () => {
    const [fakePollPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("poll"), Buffer.from("Fake Poll")],
      program.programId
    );

    try {
      await program.methods
        .createPoll("Fake Poll")
        .accounts({
          poll: fakePollPda,
          authority: impostor.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([impostor])
        .rpc();
      assert.fail("Should have failed — not admin");
    } catch (err) {
      assert.ok(err.toString().includes("Unauthorized"));
    }
  });

  // ==================== CANDIDATE TESTS ====================

  it("7. Add candidates (Alice and Bob)", async () => {
    await program.methods
      .createCandidate("Alice")
      .accounts({
        poll: pollPda,
        candidate: alicePda,
        admin: admin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    await program.methods
      .createCandidate("Bob")
      .accounts({
        poll: pollPda,
        candidate: bobPda,
        admin: admin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const alice = await program.account.candidate.fetch(alicePda);
    assert.strictEqual(alice.name, "Alice");
    assert.strictEqual(alice.voteCount.toNumber(), 0);
    assert.strictEqual(alice.poll.toBase58(), pollPda.toBase58());

    const bob = await program.account.candidate.fetch(bobPda);
    assert.strictEqual(bob.name, "Bob");
    assert.strictEqual(bob.voteCount.toNumber(), 0);
  });

  // ==================== VOTING TESTS ====================

  it("8. Reject vote when voting is closed", async () => {
    const [voteRecordPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vote_record"), pollPda.toBuffer(), voter.publicKey.toBuffer()],
      program.programId
    );

    try {
      await program.methods
        .vote()
        .accounts({
          poll: pollPda,
          candidate: alicePda,
          voter: voterPda,
          voteRecord: voteRecordPda,
          authority: voter.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([voter])
        .rpc();
      assert.fail("Should have failed — voting is closed");
    } catch (err) {
      assert.ok(err.toString().includes("VotingClosed"));
    }
  });

  it("9. Open voting", async () => {
    await program.methods
      .toggleVoting()
      .accounts({
        poll: pollPda,
        admin: admin.publicKey,
      })
      .rpc();

    const poll = await program.account.poll.fetch(pollPda);
    assert.strictEqual(poll.isActive, true);
  });

  it("10. Cast vote for Alice", async () => {
    const [voteRecordPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vote_record"), pollPda.toBuffer(), voter.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .vote()
      .accounts({
        poll: pollPda,
        candidate: alicePda,
        voter: voterPda,
        voteRecord: voteRecordPda,
        authority: voter.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([voter])
      .rpc();

    const record = await program.account.voteRecord.fetch(voteRecordPda);
    assert.strictEqual(record.poll.toBase58(), pollPda.toBase58());
    assert.strictEqual(record.voter.toBase58(), voter.publicKey.toBase58());
  });

  it("11. Verify vote count", async () => {
    const alice = await program.account.candidate.fetch(alicePda);
    assert.strictEqual(alice.voteCount.toNumber(), 1);

    const bob = await program.account.candidate.fetch(bobPda);
    assert.strictEqual(bob.voteCount.toNumber(), 0);
  });

  it("12. Reject double vote in same poll", async () => {
    const [voteRecordPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vote_record"), pollPda.toBuffer(), voter.publicKey.toBuffer()],
      program.programId
    );

    try {
      await program.methods
        .vote()
        .accounts({
          poll: pollPda,
          candidate: bobPda,
          voter: voterPda,
          voteRecord: voteRecordPda,
          authority: voter.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([voter])
        .rpc();
      assert.fail("Should have failed — already voted");
    } catch (err) {
      // VoteRecord PDA already exists → init fails
      assert.ok(err.toString().includes("already in use") || err.toString().includes("custom program error"));
    }
  });

  it("13. Close voting", async () => {
    await program.methods
      .toggleVoting()
      .accounts({
        poll: pollPda,
        admin: admin.publicKey,
      })
      .rpc();

    const poll = await program.account.poll.fetch(pollPda);
    assert.strictEqual(poll.isActive, false);
  });

  it("14. Reject vote after voting closed", async () => {
    // Use impostor as a different voter (would need credential, but the point is voting is closed)
    const [voteRecordPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vote_record"), pollPda.toBuffer(), voter.publicKey.toBuffer()],
      program.programId
    );

    try {
      await program.methods
        .vote()
        .accounts({
          poll: pollPda,
          candidate: alicePda,
          voter: voterPda,
          voteRecord: voteRecordPda,
          authority: voter.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([voter])
        .rpc();
      assert.fail("Should have failed — voting closed");
    } catch (err) {
      // Will fail for either VotingClosed or already voted — both are valid rejections
      assert.ok(err.toString().includes("VotingClosed") || err.toString().includes("already in use"));
    }
  });

  // ==================== DELETE TESTS ====================

  it("15. Delete candidates", async () => {
    await program.methods
      .closeCandidate()
      .accounts({
        poll: pollPda,
        candidate: alicePda,
        admin: admin.publicKey,
      })
      .rpc();

    await program.methods
      .closeCandidate()
      .accounts({
        poll: pollPda,
        candidate: bobPda,
        admin: admin.publicKey,
      })
      .rpc();

    // Verify Alice is gone
    try {
      await program.account.candidate.fetch(alicePda);
      assert.fail("Alice account should be closed");
    } catch (err) {
      assert.ok(err.toString().includes("does not exist") || err.toString().includes("Could not find"));
    }
  });

  it("16. Delete poll", async () => {
    await program.methods
      .closePoll()
      .accounts({
        poll: pollPda,
        admin: admin.publicKey,
      })
      .rpc();
  });

  it("17. Verify poll deletion", async () => {
    try {
      await program.account.poll.fetch(pollPda);
      assert.fail("Poll account should be closed");
    } catch (err) {
      assert.ok(err.toString().includes("does not exist") || err.toString().includes("Could not find"));
    }
  });

  // ==================== REVOCATION TESTS ====================

  it("18. Revoke credential", async () => {
    await program.methods
      .revokeCredential()
      .accounts({
        credential: credentialPda,
        issuer: admin.publicKey,
      })
      .rpc();

    const cred = await program.account.credential.fetch(credentialPda);
    assert.strictEqual(cred.isRevoked, true);
  });

  it("19. Reject registration with revoked credential", async () => {
    // Generate a fresh wallet that hasn't registered yet
    const freshVoter = Keypair.generate();
    const sig = await connection.requestAirdrop(freshVoter.publicKey, 2 * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig, "confirmed");

    // Issue a credential to freshVoter using a different student ID
    const freshStudentId = "STU-999";
    const freshIdentityHash = sha256(freshStudentId + salt);

    const [freshCredPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("credential"), freshVoter.publicKey.toBuffer()],
      program.programId
    );
    const [freshIdentityPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("identity"), freshIdentityHash],
      program.programId
    );

    const vcJson = JSON.stringify({ issuer: admin.publicKey.toBase58(), subject: freshVoter.publicKey.toBase58() });

    await program.methods
      .issueCredential(sha256(vcJson), freshIdentityHash)
      .accounts({
        credential: freshCredPda,
        identity: freshIdentityPda,
        subject: freshVoter.publicKey,
        admin: admin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    // Revoke it immediately
    await program.methods
      .revokeCredential()
      .accounts({
        credential: freshCredPda,
        issuer: admin.publicKey,
      })
      .rpc();

    // Try to register with the revoked credential
    const [freshVoterPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("anchor"), freshVoter.publicKey.toBuffer()],
      program.programId
    );

    const did = `did:sol:${freshVoter.publicKey.toBase58()}`;
    const docHash = sha256(JSON.stringify({ id: did }));

    try {
      await program.methods
        .initialize(did, "http://example.com", docHash)
        .accounts({
          voter: freshVoterPda,
          credential: freshCredPda,
          authority: freshVoter.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([freshVoter])
        .rpc();
      assert.fail("Should have failed — credential is revoked");
    } catch (err) {
      assert.ok(err.toString().includes("CredentialRevoked"));
    }
  });

  // ==================== SAFETY TEST ====================

  it("20. Reject delete while poll is active", async () => {
    // Create a new poll and open it
    const activePollName = "Active Poll";
    const [activePollPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("poll"), Buffer.from(activePollName)],
      program.programId
    );

    await program.methods
      .createPoll(activePollName)
      .accounts({
        poll: activePollPda,
        authority: admin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    // Open voting
    await program.methods
      .toggleVoting()
      .accounts({
        poll: activePollPda,
        admin: admin.publicKey,
      })
      .rpc();

    // Try to delete while active
    try {
      await program.methods
        .closePoll()
        .accounts({
          poll: activePollPda,
          admin: admin.publicKey,
        })
        .rpc();
      assert.fail("Should have failed — poll is still active");
    } catch (err) {
      assert.ok(err.toString().includes("PollStillActive"));
    }

    // Clean up: close voting so the poll can be deleted later
    await program.methods
      .toggleVoting()
      .accounts({
        poll: activePollPda,
        admin: admin.publicKey,
      })
      .rpc();
  });

  // ==================== INPUT VALIDATION TESTS ====================

  it("21. Reject empty candidate name", async () => {
    // Create a poll for this test
    const valPollName = "Validation Poll";
    const [valPollPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("poll"), Buffer.from(valPollName)],
      program.programId
    );

    await program.methods
      .createPoll(valPollName)
      .accounts({
        poll: valPollPda,
        authority: admin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const [emptyCandPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("candidate"), valPollPda.toBuffer(), Buffer.from("")],
      program.programId
    );

    try {
      await program.methods
        .createCandidate("")
        .accounts({
          poll: valPollPda,
          candidate: emptyCandPda,
          admin: admin.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      assert.fail("Should have failed — empty candidate name");
    } catch (err) {
      assert.ok(err.toString().includes("CandidateNameEmpty"));
    }
  });

  it("22. Reject empty poll name", async () => {
    const [emptyPollPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("poll"), Buffer.from("")],
      program.programId
    );

    try {
      await program.methods
        .createPoll("")
        .accounts({
          poll: emptyPollPda,
          authority: admin.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      assert.fail("Should have failed — empty poll name");
    } catch (err) {
      assert.ok(err.toString().includes("PollNameEmpty"));
    }
  });

  it("23. Reject wrong doc hash length", async () => {
    // Fresh wallet with a credential
    const voter3 = Keypair.generate();
    const sig = await connection.requestAirdrop(voter3.publicKey, 2 * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig, "confirmed");

    const freshStudentId = "STU-888";
    const freshIdentityHash = sha256(freshStudentId + salt);

    const [freshCredPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("credential"), voter3.publicKey.toBuffer()],
      program.programId
    );
    const [freshIdentityPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("identity"), freshIdentityHash],
      program.programId
    );

    const vcJson = JSON.stringify({ issuer: admin.publicKey.toBase58(), subject: voter3.publicKey.toBase58() });

    await program.methods
      .issueCredential(sha256(vcJson), freshIdentityHash)
      .accounts({
        credential: freshCredPda,
        identity: freshIdentityPda,
        subject: voter3.publicKey,
        admin: admin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const [voter3Pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("anchor"), voter3.publicKey.toBuffer()],
      program.programId
    );

    const did = `did:sol:${voter3.publicKey.toBase58()}`;
    // 31 bytes instead of 32
    const badHash = Buffer.alloc(31, 0xff);

    try {
      await program.methods
        .initialize(did, "http://example.com", badHash)
        .accounts({
          voter: voter3Pda,
          credential: freshCredPda,
          authority: voter3.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([voter3])
        .rpc();
      assert.fail("Should have failed — hash is 31 bytes not 32");
    } catch (err) {
      assert.ok(err.toString().includes("DidDocHashLengthInvalid"));
    }
  });

  // ==================== ACCESS CONTROL TESTS ====================

  it("24. Non-admin tries to add candidates", async () => {
    // Reuse "Active Poll" from test 20
    const [activePollPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("poll"), Buffer.from("Active Poll")],
      program.programId
    );

    const [hackerCandPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("candidate"), activePollPda.toBuffer(), Buffer.from("Hacker")],
      program.programId
    );

    try {
      await program.methods
        .createCandidate("Hacker")
        .accounts({
          poll: activePollPda,
          candidate: hackerCandPda,
          admin: impostor.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([impostor])
        .rpc();
      assert.fail("Should have failed — impostor is not admin");
    } catch (err) {
      assert.ok(err.toString().includes("has_one") || err.toString().includes("ConstraintHasOne") || err.toString().includes("A has one constraint was violated"));
    }
  });

  it("25. Non-admin tries to toggle voting", async () => {
    const [activePollPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("poll"), Buffer.from("Active Poll")],
      program.programId
    );

    try {
      await program.methods
        .toggleVoting()
        .accounts({
          poll: activePollPda,
          admin: impostor.publicKey,
        })
        .signers([impostor])
        .rpc();
      assert.fail("Should have failed — impostor is not admin");
    } catch (err) {
      assert.ok(err.toString().includes("has_one") || err.toString().includes("ConstraintHasOne") || err.toString().includes("A has one constraint was violated"));
    }
  });

  it("26. Non-admin tries to revoke a credential", async () => {
    try {
      await program.methods
        .revokeCredential()
        .accounts({
          credential: credentialPda,
          issuer: impostor.publicKey,
        })
        .signers([impostor])
        .rpc();
      assert.fail("Should have failed — impostor is not the issuer");
    } catch (err) {
      assert.ok(err.toString().includes("has_one") || err.toString().includes("ConstraintHasOne") || err.toString().includes("A has one constraint was violated"));
    }
  });

  // ==================== MULTI-POLL TESTS ====================

  it("27. Create second poll and add candidates", async () => {
    const secondPollName = "Second Election";
    const [secondPollPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("poll"), Buffer.from(secondPollName)],
      program.programId
    );

    await program.methods
      .createPoll(secondPollName)
      .accounts({
        poll: secondPollPda,
        authority: admin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const [charliePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("candidate"), secondPollPda.toBuffer(), Buffer.from("Charlie")],
      program.programId
    );
    const [dianaPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("candidate"), secondPollPda.toBuffer(), Buffer.from("Diana")],
      program.programId
    );

    await program.methods
      .createCandidate("Charlie")
      .accounts({
        poll: secondPollPda,
        candidate: charliePda,
        admin: admin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    await program.methods
      .createCandidate("Diana")
      .accounts({
        poll: secondPollPda,
        candidate: dianaPda,
        admin: admin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const charlie = await program.account.candidate.fetch(charliePda);
    assert.strictEqual(charlie.name, "Charlie");
    assert.strictEqual(charlie.voteCount.toNumber(), 0);

    const diana = await program.account.candidate.fetch(dianaPda);
    assert.strictEqual(diana.name, "Diana");
    assert.strictEqual(diana.voteCount.toNumber(), 0);

    // Open voting
    await program.methods
      .toggleVoting()
      .accounts({
        poll: secondPollPda,
        admin: admin.publicKey,
      })
      .rpc();
  });

  it("28. Same voter votes in second poll (proves per-poll VoteRecord)", async () => {
    // This voter already voted in "Test Election" (test 10)
    // They should be able to vote in "Second Election" because VoteRecord is per-poll
    const secondPollName = "Second Election";
    const [secondPollPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("poll"), Buffer.from(secondPollName)],
      program.programId
    );

    const [charliePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("candidate"), secondPollPda.toBuffer(), Buffer.from("Charlie")],
      program.programId
    );

    const [voteRecordPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vote_record"), secondPollPda.toBuffer(), voter.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .vote()
      .accounts({
        poll: secondPollPda,
        candidate: charliePda,
        voter: voterPda,
        voteRecord: voteRecordPda,
        authority: voter.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([voter])
      .rpc();

    const charlie = await program.account.candidate.fetch(charliePda);
    assert.strictEqual(charlie.voteCount.toNumber(), 1);

    const record = await program.account.voteRecord.fetch(voteRecordPda);
    assert.strictEqual(record.poll.toBase58(), secondPollPda.toBase58());
    assert.strictEqual(record.voter.toBase58(), voter.publicKey.toBase58());
  });

  it("29. Reject duplicate candidate name in same poll", async () => {
    const secondPollName = "Second Election";
    const [secondPollPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("poll"), Buffer.from(secondPollName)],
      program.programId
    );

    // "Charlie" already exists in "Second Election" from test 27
    const [charliePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("candidate"), secondPollPda.toBuffer(), Buffer.from("Charlie")],
      program.programId
    );

    try {
      await program.methods
        .createCandidate("Charlie")
        .accounts({
          poll: secondPollPda,
          candidate: charliePda,
          admin: admin.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      assert.fail("Should have failed — Charlie already exists in this poll");
    } catch (err) {
      assert.ok(err.toString().includes("already in use") || err.toString().includes("custom program error"));
    }
  });
});
