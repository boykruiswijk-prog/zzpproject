-- Create enum for app roles
CREATE TYPE public.app_role AS ENUM ('admin', 'medewerker');

-- Create enum for lead status
CREATE TYPE public.lead_status AS ENUM ('nieuw', 'in_behandeling', 'afspraak_gepland', 'offerte_verstuurd', 'klant', 'afgewezen');

-- Create enum for lead type
CREATE TYPE public.lead_type AS ENUM ('contact', 'verzekering_aanvraag');

-- Create enum for lead source
CREATE TYPE public.lead_bron AS ENUM ('website', 'telefoon', 'email');

-- Create enum for note type
CREATE TYPE public.note_type AS ENUM ('notitie', 'follow_up', 'telefoongesprek');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Create leads table
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  type lead_type NOT NULL DEFAULT 'contact',
  status lead_status NOT NULL DEFAULT 'nieuw',
  voornaam TEXT NOT NULL,
  achternaam TEXT NOT NULL,
  email TEXT NOT NULL,
  telefoon TEXT,
  geboortedatum DATE,
  bedrijfsnaam TEXT,
  kvk_nummer TEXT,
  beroep TEXT,
  omzet TEXT,
  verzekering_type TEXT,
  verzekerd_bedrag TEXT,
  eigen_risico TEXT,
  ingangsdatum DATE,
  opmerkingen TEXT,
  bron lead_bron NOT NULL DEFAULT 'website',
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  converted_at TIMESTAMP WITH TIME ZONE
);

-- Create lead_notes table
CREATE TABLE public.lead_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  type note_type NOT NULL DEFAULT 'notitie',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_notes ENABLE ROW LEVEL SECURITY;

-- Security definer function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check if user has any admin role
CREATE OR REPLACE FUNCTION public.is_team_member(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
  )
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Team members can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_team_member(auth.uid()));

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for leads (only team members)
CREATE POLICY "Team members can view leads"
  ON public.leads FOR SELECT
  TO authenticated
  USING (public.is_team_member(auth.uid()));

CREATE POLICY "Team members can insert leads"
  ON public.leads FOR INSERT
  TO authenticated
  WITH CHECK (public.is_team_member(auth.uid()));

CREATE POLICY "Allow anonymous lead submissions"
  ON public.leads FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Team members can update leads"
  ON public.leads FOR UPDATE
  TO authenticated
  USING (public.is_team_member(auth.uid()));

CREATE POLICY "Admins can delete leads"
  ON public.leads FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for lead_notes
CREATE POLICY "Team members can view notes"
  ON public.lead_notes FOR SELECT
  TO authenticated
  USING (public.is_team_member(auth.uid()));

CREATE POLICY "Team members can insert notes"
  ON public.lead_notes FOR INSERT
  TO authenticated
  WITH CHECK (public.is_team_member(auth.uid()) AND user_id = auth.uid());

CREATE POLICY "Users can update their own notes"
  ON public.lead_notes FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own notes"
  ON public.lead_notes FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Trigger function for updating updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();