-- Create chat sessions table
CREATE TABLE IF NOT EXISTS public.chat_sessions (
    id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title text DEFAULT 'New Conversation',
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS for chat sessions
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own chat sessions"
    ON public.chat_sessions
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Create chat messages table
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id text PRIMARY KEY,
    session_id text NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('user', 'assistant')),
    content text NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS for chat messages
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own chat messages"
    ON public.chat_messages
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Create chat telemetry table for developer audits
CREATE TABLE IF NOT EXISTS public.chat_telemetry (
    id text PRIMARY KEY,
    message_id text REFERENCES public.chat_messages(id) ON DELETE CASCADE,
    session_id text REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    model text NOT NULL,
    prompt_version text NOT NULL,
    retrieved_context_ids jsonb DEFAULT '[]'::jsonb,
    tool_calls jsonb DEFAULT '[]'::jsonb,
    latency_ms integer,
    status text NOT NULL CHECK (status IN ('success', 'failed')),
    error_message text,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS for chat telemetry
ALTER TABLE public.chat_telemetry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own chat telemetry"
    ON public.chat_telemetry
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own chat telemetry"
    ON public.chat_telemetry
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Create chat evaluations table
CREATE TABLE IF NOT EXISTS public.chat_evaluations (
    id text PRIMARY KEY,
    telemetry_id text NOT NULL REFERENCES public.chat_telemetry(id) ON DELETE CASCADE,
    evaluator text NOT NULL,
    rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
    flags jsonb DEFAULT '[]'::jsonb,
    comments text,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS for chat evaluations
ALTER TABLE public.chat_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own chat evaluations"
    ON public.chat_evaluations
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.chat_telemetry t
            WHERE t.id = telemetry_id AND t.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.chat_telemetry t
            WHERE t.id = telemetry_id AND t.user_id = auth.uid()
        )
    );
