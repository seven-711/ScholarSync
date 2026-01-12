
export enum UserRole {
  SUPER_ADMIN = 'super_admin', // Full system access
  ADMIN = 'admin',       // School/Department Coordinator
  SCHOLAR = 'scholar'    // Restricted access
}

export interface Profile {
  id: string;
  email: string;
  password?: string;
  full_name: string;
  role: UserRole;
  is_approved: boolean;
  created_at?: string;
  // Enhanced Fields
  school?: string;       // University/School Name
  course?: string;       // Program/Course
  department?: string;   // Kept for backward compat, or mapped to College
  year_level?: string;
  semester?: string;     // Current Semester
  id_photo_data?: string;
  enrollment_proof_data?: string; // New: Proof of enrollment
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  created_at: string;
  author_id?: string;
  image_data?: string;
}

export interface Assignment {
  id: string;
  title: string;
  description: string;
  requires_photo: boolean;
  due_date: string;
  created_at: string;
  course_filter?: string; // Optional: Assign to specific course
}

export interface Submission {
  id: string;
  assignment_id: string;
  scholar_id: string;
  content?: string;
  photo_data?: string;
  submitted_at: string;
  status?: 'submitted' | 'returned';
  feedback?: string;
  scholar?: Profile;
  assignment?: Assignment;
}

export interface InquiryMessage {
  id: string;
  inquiry_id: string;
  sender_role: 'admin' | 'scholar'; // simplified for now
  message: string;
  created_at: string;
}

export interface Inquiry {
  id: string;
  scholar_id: string;
  subject: string;
  status: 'pending' | 'resolved' | 'pending_scholar' | 'pending_admin';
  created_at: string;
  updated_at?: string;
  scholar?: Profile;
  scholar_read?: boolean;
  messages?: InquiryMessage[];

  message?: string;
  admin_reply?: string;
  replied_at?: string;
}

// --- NEW SDP INTERFACES ---
export interface SDPRequirement {
  id: string;
  year_level: string;
  semester?: string;
  description: string;
  required_hours?: number;
  activity_type: string; // e.g., 'Community Service', 'Leadership'
}

export interface SDPRecord {
  id: string;
  scholar_id: string;
  requirement_id?: string; // Optional, can be ad-hoc
  activity_name: string;
  description: string;
  hours_rendered: number;
  proof_data?: string; // Base64 image/pdf
  status: 'submitted' | 'approved' | 'rejected';
  admin_feedback: string;
}

export interface SDPOpportunity {
  id: string;
  title: string;
  description: string;
  date_of_activity: string;
  location?: string;
  created_by: string; // profile id
  creator?: Profile; // joined
  school?: string; // null for global
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string;
  action: string;
  details: string;
  created_at: string;
  actor_name?: string; // Joined field
}

// SQL Setup Instructions for the user
export const SQL_SETUP_INSTRUCTIONS = `
-- ⚠️ IMPORTANT: Run this entire block in Supabase SQL Editor to enable DEMO MODE ⚠️

-- 1. Create Tables
create table if not exists public.profiles (
  id uuid primary key, 
  email text,
  password text,
  full_name text,
  role text, -- check constraint removed to allow flexibility/updates
  is_approved boolean default false,
  created_at timestamptz default now()
);

alter table public.profiles add column if not exists password text;

-- 2. CLEANUP: Remove conflicting accounts
delete from public.profiles 
where email in ('admin@scholarsync.com', 'scholar@scholarsync.com', 'super@scholarsync.com')
and id not in ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003');

-- Add unique constraint
create unique index if not exists profiles_email_idx on public.profiles (email);

create table if not exists public.announcements (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  content text not null,
  created_at timestamptz default now(),
  image_data text
);

create table if not exists public.assignments (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text not null,
  requires_photo boolean default false,
  due_date timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.submissions (
  id uuid default gen_random_uuid() primary key,
  assignment_id uuid references public.assignments not null,
  scholar_id uuid references public.profiles not null,
  content text,
  photo_data text,
  submitted_at timestamptz default now(),
  status text default 'submitted',
  feedback text
);

-- 6. NEW: Add Reg Details Columns
alter table public.profiles add column if not exists department text;
alter table public.profiles add column if not exists year_level text;
alter table public.profiles add column if not exists id_photo_data text;
-- Enhanced Fields
alter table public.profiles add column if not exists school text;
alter table public.profiles add column if not exists course text;
alter table public.profiles add column if not exists semester text;
alter table public.profiles add column if not exists enrollment_proof_data text;

-- 7. Inquiries
create table if not exists public.inquiries (
  id uuid default gen_random_uuid() primary key,
  scholar_id uuid references public.profiles on delete cascade not null,
  subject text not null,
  message text,
  admin_reply text,
  replied_at timestamptz,
  status text default 'pending',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  scholar_read boolean default false
);

alter table public.inquiries drop constraint if exists inquiries_status_check;
alter table public.inquiries add constraint inquiries_status_check check (status in ('pending', 'resolved', 'pending_scholar', 'pending_admin'));

create table if not exists public.inquiry_messages (
  id uuid default gen_random_uuid() primary key,
  inquiry_id uuid references public.inquiries on delete cascade not null,
  sender_role text,
  message text not null,
  created_at timestamptz default now()
);

-- --- NEW TABLES FOR ENHANCED FEATURES ---

-- 8. SDP Requirements
create table if not exists public.sdp_requirements (
  id uuid default gen_random_uuid() primary key,
  year_level text not null, 
  semester text,
  description text not null,
  required_hours integer,
  activity_type text,
  created_at timestamptz default now()
);

-- 9. SDP Records
create table if not exists public.sdp_records (
  id uuid default gen_random_uuid() primary key,
  scholar_id uuid references public.profiles on delete cascade not null,
  requirement_id uuid references public.sdp_requirements, 
  activity_name text not null,
  description text,
  hours_rendered numeric default 0,
  proof_data text,
  status text default 'submitted' check (status in ('submitted', 'approved', 'rejected')),
  admin_feedback text,
  date_conducted date,
  submitted_at timestamptz default now()
);

-- 9.5 SDP Opportunities (New)
create table if not exists public.sdp_opportunities (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text not null,
  date_of_activity date,
  location text,
  created_by uuid references public.profiles,
  school text, -- Null if global/CEDO
  created_at timestamptz default now()
);

-- 10. Audit Logs
create table if not exists public.audit_logs (
  id uuid default gen_random_uuid() primary key,
  actor_id uuid references public.profiles,
  action text not null,
  details text,
  created_at timestamptz default now()
);

-- 11. Disable RLS
alter table public.profiles disable row level security;
alter table public.announcements disable row level security;
alter table public.assignments disable row level security;
alter table public.submissions disable row level security;
alter table public.inquiries disable row level security;
alter table public.inquiry_messages disable row level security;
alter table public.sdp_requirements disable row level security;
alter table public.sdp_records disable row level security;
alter table public.sdp_opportunities disable row level security;
alter table public.audit_logs disable row level security;

-- 12. Insert SEED DATA
insert into public.profiles (id, email, password, full_name, role, is_approved, school, course)
values 
  ('00000000-0000-0000-0000-000000000001', 'admin@scholarsync.com', 'admin123', 'School Coordinator', 'admin', true, 'Tech University', 'CS Dept'),
  ('00000000-0000-0000-0000-000000000002', 'scholar@scholarsync.com', 'scholar123', 'Jane Scholar', 'scholar', true, 'Tech University', 'Computer Science'),
  ('00000000-0000-0000-0000-000000000003', 'super@scholarsync.com', 'super123', 'Super Admin', 'super_admin', true, 'CEDO Main', 'Administration')
on conflict (id) do update set
  email = excluded.email,
  password = excluded.password,
  role = excluded.role,
  full_name = excluded.full_name;

-- 13. Insert SDP Requirements (Default Rules)
INSERT INTO public.sdp_requirements (year_level, activity_type, description, required_hours) VALUES
('1st Year', 'Community Engagement', 'Mandatory participation for 1st Year', 7),
('2nd Year', 'Community Engagement', 'Mandatory participation for 2nd Year', 7),
('3rd Year', 'Community Engagement', 'Mandatory participation for 3rd Year', 5),
('4th Year', 'Community Engagement', 'Mandatory participation for 4th Year', 4),
('5th Year', 'Community Engagement', 'Mandatory participation for 5th Year', 4);
`;

export const SQL_RESET_SCRIPT = `
-- ⚠️ DANGER: RESET SCHOLAR DATA ⚠️
-- Run this in Supabase SQL Editor to wipe all Scholar data while keeping Admins.

BEGIN;

-- 1. Delete Related App Data (Cascading usually handles this, but being explicit is safer)
DELETE FROM public.submissions 
WHERE scholar_id IN (SELECT id FROM public.profiles WHERE role = 'scholar');

DELETE FROM public.sdp_records 
WHERE scholar_id IN (SELECT id FROM public.profiles WHERE role = 'scholar');

DELETE FROM public.inquiries 
WHERE scholar_id IN (SELECT id FROM public.profiles WHERE role = 'scholar');

DELETE FROM public.audit_logs 
WHERE actor_id IN (SELECT id FROM public.profiles WHERE role = 'scholar');

-- 2. Delete Public Profiles (Scholars Only)
DELETE FROM public.profiles 
WHERE role = 'scholar';

-- 3. Delete Auth Users (Cleanup Login Credentials)
-- Deletes any auth user that no longer has a corresponding public profile
DELETE FROM auth.users 
WHERE id NOT IN (SELECT id FROM public.profiles);

COMMIT;
`;