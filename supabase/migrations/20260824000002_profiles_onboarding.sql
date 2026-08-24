-- Add columns to profiles table to store onboarding and tutorial states persistently
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tours_completed jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tutorial_seen boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pwa_prompt_dismissed boolean DEFAULT false;
