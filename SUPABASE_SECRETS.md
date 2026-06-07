# Supabase Secrets Management

This document tracks environment secrets required by Supabase Edge Functions.

## Current Secrets

### GROQ_API_KEY
- **Purpose**: Powers voice transcription via Groq's Whisper API
- **Used by**: `supabase/functions/transcribe-audio/index.ts`
- **Last updated**: 2026-06-07
- **Set via**: `npx supabase secrets set GROQ_API_KEY="<key>"`

## How to Update Secrets

1. **Via Supabase CLI** (recommended):
   ```bash
   npx supabase secrets set SECRET_NAME="value"
   ```

2. **Via Supabase Dashboard**:
   - Go to Project Settings → Edge Functions
   - Add/update secrets in the Environment Variables section

3. **Verify**:
   ```bash
   npx supabase secrets list
   ```

## Notes

- Secrets are managed at the project level, not in code
- Never commit actual secret values to git
- Update this doc when adding new secrets or changing their purpose
