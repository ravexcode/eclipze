// A valid scrypt hash of a random, discarded password. Sign-in checks it when the email has
// no password, so unknown accounts take as long to reject as a wrong password.
export const DUMMY_PASSWORD_HASH = "scrypt:e60661cd6f80bff706c5ae629738e065:70dca9e5099bcc71b157d1b279f246c76d2f77e1920d22d480b90829ea7d53b8b3534448dc17e7ef6b44faeae239e8d290c6795dde8043f9ca33528519208b3a";
