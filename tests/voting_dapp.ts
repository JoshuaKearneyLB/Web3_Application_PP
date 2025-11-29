import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SystemProgram, PublicKey } from "@solana/web3.js";
import { assert } from "chai";
import { VotingDapp } from "../target/types/voting_dapp";

describe("voting_dapp", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.votingDapp as Program<VotingDapp>;
  const provider = anchor.getProvider();
  const authority = provider.wallet;

  it("Is initialized!", async () => {
    const did = `did:sol:${authority.publicKey.toBase58()}`;

    const [voterPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("anchor"), authority.publicKey.toBuffer()],
      program.programId
    );

    const tx = await program.methods
      .initialize(did)
      .accounts({
        voter: voterPda,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("Your transaction signature", tx);

    const voterAccount = await program.account.voter.fetch(voterPda);
    assert.strictEqual(voterAccount.did, did);
    assert.strictEqual(voterAccount.hasVoted, false);
    assert.strictEqual(voterAccount.authority.toBase58(), authority.publicKey.toBase58());
  });
});
