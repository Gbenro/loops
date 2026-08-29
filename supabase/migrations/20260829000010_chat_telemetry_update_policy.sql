-- Allow authenticated users and server to update chat telemetry for voice output recording
CREATE POLICY "Users can update their own chat telemetry"
    ON public.chat_telemetry
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow public/anon update on chat_telemetry"
    ON public.chat_telemetry
    FOR UPDATE
    TO anon
    USING (true)
    WITH CHECK (true);
