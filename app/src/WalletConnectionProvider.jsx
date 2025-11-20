// Letting the user Connect their wallet at this point
//

import React,{ useMemo } from "react";
import {
    ConnectionProvider,
    WalletProvider,
} from "@solana/wallet-adapter-react";
import {WalletModalProvider} from "@solana/wallet-adapter-react-ui";
import {PhantomWalletAdapter} from "@solana/wallet-adapter-wallets";
import "@solana/wallet-adapter-react-ui/styles.css";

export const WalletConnectionProvider = ({children}) => {
    const endpoint = "http://127.0.0.1:8899"; //Reference what blockchain to talk to

    const wallets = useMemo(
        () => [new PhantomWalletAdapter()],
        [] 
    );

    return (
        <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets}>
                <WalletModalProvider>{children}</WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>


    );
};
