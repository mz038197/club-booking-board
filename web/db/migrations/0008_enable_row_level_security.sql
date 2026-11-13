-- Supabase exposes the public schema through its REST API (PostgREST) to the anon and
-- authenticated roles. Only this app's server touches the database, connecting as the
-- tables' owner, which RLS does not restrict. Enabling RLS with no policies closes the
-- REST path entirely. Harmless on PGlite (tests run as the owner too).
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_current_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;
