import * as anchor from "@coral-xyz/anchor";
import { SystemProgram, PublicKey } from "@solana/web3.js";
import { assert } from "chai";
import { createHash } from "crypto";
import { VotingDapp } from "../target/types/voting_dapp";

describe("voting_dapp", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.votingDapp as anchor.Program<VotingDapp>;
  const provider = anchor.getProvider();
  const authority = provider.wallet;

  it("Is initialized!", async () => {
    const did = `did:sol:${authority.publicKey.toBase58()}`;
    const docUri = "https://example.com/did.json";
    const docContent = JSON.stringify({ did, eligibility: true });
    const docHash = createHash("sha256").update(docContent).digest();

    const [voterPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("anchor"), authority.publicKey.toBuffer()],
      program.programId
    );

    const tx = await program.methods
      .initialize(did, docUri, Array.from(docHash))
      .accounts({
        voter: voterPda,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("Your transaction signature", tx);

    const voterAccount = await program.account.voter.fetch(voterPda);
    assert.strictEqual(voterAccount.did, did);
    assert.strictEqual(voterAccount.docUri, docUri);
    assert.deepStrictEqual(Buffer.from(voterAccount.docHash), docHash);
    assert.strictEqual(voterAccount.hasVoted, false);
    assert.strictEqual(voterAccount.authority.toBase58(), authority.publicKey.toBase58());
  });
});
