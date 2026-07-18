# Getting Started

1. Start the server.
2. Open the web client.
3. Enter an email and account password for server authentication.
4. Register the account with a new master password of at least 12 characters and confirmation.
5. Create a login item.
6. Run sync to verify the self-hosted API is reachable.

Regular login uses only the email and account password. The master password is
not sent to the server; it is requested separately only when creating or
unlocking/restoring the encrypted vault on a device. A forgotten server account
password cannot currently be reset with the master password; secure recovery is
tracked by #501.
