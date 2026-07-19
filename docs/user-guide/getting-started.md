# Getting Started

1. Start the server.
2. Open the web client.
3. Enter an email and account password for server authentication.
4. Register the account with a new master password of at least 12 characters and confirmation.
5. Create a login item.
6. Run sync to verify the self-hosted API is reachable.

Regular login uses only the email and account password. The master password is
not sent to the server; it is requested separately only when creating,
unlocking/restoring, or recovering account access on a device. Use **Forgot
account password?** in Web or Android to choose a new account password. The
master password decrypts a recovery signing key locally, and successful
recovery rotates that key. Accounts created before v0.1.11 must first use
**Enable / rotate recovery** while signed in and unlocked. A forgotten master
password remains unrecoverable.
