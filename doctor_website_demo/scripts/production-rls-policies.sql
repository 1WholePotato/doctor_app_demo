-- Production RLS Policies for MedLearn CME Platform
-- Note: As per project guidelines, RLS is temporarily disabled in development for RAD.
-- Run this script when enabling RLS for staging/production deployment.

-- Enable RLS on core tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instructor_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instructors ENABLE ROW LEVEL SECURITY;

-- Helper function to check if current authenticated user has Admin role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.roles r ON u.role_id = r.id
    WHERE u.id = auth.uid()
      AND (lower(r.name) LIKE '%admin%' OR u.role_id = 'ef387d99-bdbd-4304-b6ab-946b58475aa1')
  );
$$;

-- 1. ROLES
-- Anyone authenticated can view roles
CREATE POLICY "Allow authenticated read roles"
  ON public.roles FOR SELECT
  TO authenticated
  USING (true);

-- 2. USERS
-- Users can view their own profile; Admins can view all profiles
CREATE POLICY "Users can view own profile or admins view all"
  ON public.users FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.is_admin());

-- Users can update their own profile; Admins can update any user
CREATE POLICY "Users can update own profile or admins update any"
  ON public.users FOR UPDATE
  TO authenticated
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

-- Allow new user registration insertion
CREATE POLICY "Allow self registration"
  ON public.users FOR INSERT
  TO authenticated, anon
  WITH CHECK (id = auth.uid() OR auth.uid() IS NULL);

-- 3. COURSES & SESSIONS
-- Active courses and sessions are publicly readable or visible to authenticated students
CREATE POLICY "Public or authenticated view active courses"
  ON public.courses FOR SELECT
  TO authenticated, anon
  USING (active = true OR public.is_admin());

CREATE POLICY "Admin manage courses"
  ON public.courses FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Public or authenticated view sessions"
  ON public.course_sessions FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Admin manage sessions"
  ON public.course_sessions FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 4. BOOKINGS
-- Students can only view their own bookings; Admins can view all bookings
CREATE POLICY "Students view own bookings or admins view all"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Students create own bookings"
  ON public.bookings FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Students update own bookings or admins update all"
  ON public.bookings FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- 5. INSTRUCTOR ASSIGNMENTS
-- Only admins can assign instructors to courses (closes privilege escalation hole)
CREATE POLICY "Only admins can manage instructor assignments"
  ON public.instructor_courses FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Authenticated read instructor assignments"
  ON public.instructor_courses FOR SELECT
  TO authenticated
  USING (true);
