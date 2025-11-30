
export enum UserRole {
  ADMIN = 'admin',
  SCHOLAR = 'scholar'
}

export interface Profile {
  id: string;
  email: string;
  password?: string;
  full_name: string;
  role: UserRole;
  is_approved: boolean;
  created_at?: string;
  // New Fields
  department?: string;
  year_level?: string;
  id_photo_data?: string; // Base64 image string
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  created_at: string;
  author_id?: string;
  image_data?: string; // New: Base64 image string for cover
}

export interface Assignment {
  id: string;
  title: string;
  description: string;
  requires_photo: boolean;
  due_date: string;
  created_at: string;
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
  sender_role: 'admin' | 'scholar';
  message: string;
  created_at: string;
}

export interface Inquiry {
  id: string;
  scholar_id: string;
  subject: string;
  status: 'pending' | 'resolved' | 'pending_scholar' | 'pending_admin'; // Updated status
  created_at: string;
  updated_at?: string;
  scholar?: Profile;
  scholar_read?: boolean; 
  messages?: InquiryMessage[]; // Joined messages
  
  // Deprecated fields (kept for backward compatibility during migration)
  message?: string;
  admin_reply?: string;
  replied_at?: string;
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
  role text check (role in ('admin', 'scholar')),
  is_approved boolean default false,
  created_at timestamptz default now()
);

-- Ensure password column exists
alter table public.profiles add column if not exists password text;

-- 2. CLEANUP: Remove conflicting accounts
delete from public.profiles 
where email in ('admin@scholarsync.com', 'scholar@scholarsync.com')
and id not in ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002');

-- Add unique constraint
create unique index if not exists profiles_email_idx on public.profiles (email);

create table if not exists public.announcements (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  content text not null,
  created_at timestamptz default now()
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
  submitted_at timestamptz default now()
);

-- 5. Add Status and Feedback columns for "Return Assignment" feature
alter table public.submissions add column if not exists status text default 'submitted';
alter table public.submissions add column if not exists feedback text;

-- 6. NEW: Add Registration Details Columns
alter table public.profiles add column if not exists department text;
alter table public.profiles add column if not exists year_level text;
alter table public.profiles add column if not exists id_photo_data text;

-- 7. NEW: Inquiries / Support Module
create table if not exists public.inquiries (
  id uuid default gen_random_uuid() primary key,
  scholar_id uuid references public.profiles not null,
  subject text not null,
  
  -- Legacy fields (can be null for new system)
  message text,
  admin_reply text,
  replied_at timestamptz,

  status text default 'pending',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 8. NEW: Add Read Status for Inquiries
alter table public.inquiries add column if not exists scholar_read boolean default false;

-- 9. NEW: Threaded Messages Table
create table if not exists public.inquiry_messages (
  id uuid default gen_random_uuid() primary key,
  inquiry_id uuid references public.inquiries on delete cascade not null,
  sender_role text check (sender_role in ('admin', 'scholar')),
  message text not null,
  created_at timestamptz default now()
);

-- 10. REPAIR: Force Fix Missing Relationships (If joins are failing)
alter table public.inquiries drop constraint if exists inquiries_scholar_id_fkey;
alter table public.inquiries add constraint inquiries_scholar_id_fkey foreign key (scholar_id) references public.profiles(id) on delete cascade;

alter table public.submissions drop constraint if exists submissions_scholar_id_fkey;
alter table public.submissions add constraint submissions_scholar_id_fkey foreign key (scholar_id) references public.profiles(id) on delete cascade;

-- 11. REPAIR: Fix Status Constraints (Allow new status types)
alter table public.inquiries drop constraint if exists inquiries_status_check;
alter table public.inquiries add constraint inquiries_status_check check (status in ('pending', 'resolved', 'pending_scholar', 'pending_admin'));

-- 12. NEW: Add Image Data to Announcements
alter table public.announcements add column if not exists image_data text;

-- 3. DISABLE Row Level Security (RLS) for Demo Mode
alter table public.profiles disable row level security;
alter table public.announcements disable row level security;
alter table public.assignments disable row level security;
alter table public.submissions disable row level security;
alter table public.inquiries disable row level security;
alter table public.inquiry_messages disable row level security;

-- 4. Insert SEED DATA (Test Users)
insert into public.profiles (id, email, password, full_name, role, is_approved, department, year_level)
values 
  ('00000000-0000-0000-0000-000000000001', 'admin@scholarsync.com', 'admin123', 'System Admin', 'admin', true, 'IT', 'N/A'),
  ('00000000-0000-0000-0000-000000000002', 'scholar@scholarsync.com', 'scholar123', 'Jane Scholar', 'scholar', true, 'Computer Science', '3rd Year')
on conflict (id) do update set
  email = excluded.email,
  password = excluded.password,
  role = excluded.role,
  full_name = excluded.full_name,
  is_approved = excluded.is_approved,
  department = excluded.department,
  year_level = excluded.year_level;
`;