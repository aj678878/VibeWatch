# Environment Variables Setup

## GUEST_SESSION_SECRET

This is a secret key used to sign guest session cookies. It should be a random, secure string.

### How to generate:

**Option 1: Using OpenSSL (recommended)**
```bash
openssl rand -hex 32
```

**Option 2: Using Node.js**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Option 3: Online generator**
Visit https://randomkeygen.com/ and use a "CodeIgniter Encryption Keys" or generate a random 64-character hex string.

### Add to `.env.local`:

```
GUEST_SESSION_SECRET=your-generated-secret-key-here
```

**Important**: 
- Use a different secret for production
- Never commit this to version control
- Keep it secure - if leaked, guest sessions could be forged

### Example:
```
GUEST_SESSION_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```
