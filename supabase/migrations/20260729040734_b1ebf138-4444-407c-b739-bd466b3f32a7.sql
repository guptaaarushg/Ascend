
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_display_name_len CHECK (display_name IS NULL OR char_length(display_name) <= 80),
  ADD CONSTRAINT profiles_location_len CHECK (location IS NULL OR char_length(location) <= 120),
  ADD CONSTRAINT profiles_country_len CHECK (country IS NULL OR char_length(country) <= 80),
  ADD CONSTRAINT profiles_prof_exp_len CHECK (professional_experience IS NULL OR char_length(professional_experience) <= 2000),
  ADD CONSTRAINT profiles_socio_len CHECK (socioeconomic_info IS NULL OR char_length(socioeconomic_info) <= 2000),
  ADD CONSTRAINT profiles_goals_len CHECK (long_term_goals IS NULL OR char_length(long_term_goals) <= 2000),
  ADD CONSTRAINT profiles_bio_len CHECK (bio IS NULL OR char_length(bio) <= 2000),
  ADD CONSTRAINT profiles_major_len CHECK (intended_major IS NULL OR char_length(intended_major) <= 120),
  ADD CONSTRAINT profiles_college_notes_len CHECK (college_notes IS NULL OR char_length(college_notes) <= 2000),
  ADD CONSTRAINT profiles_immigration_note_len CHECK (immigration_status_note IS NULL OR char_length(immigration_status_note) <= 500),
  ADD CONSTRAINT profiles_arrays_len CHECK (
    array_length(academic_interests, 1) IS NULL OR array_length(academic_interests, 1) <= 50
  ),
  ADD CONSTRAINT profiles_career_len CHECK (
    array_length(career_interests, 1) IS NULL OR array_length(career_interests, 1) <= 50
  ),
  ADD CONSTRAINT profiles_skills_len CHECK (
    array_length(skills, 1) IS NULL OR array_length(skills, 1) <= 50
  ),
  ADD CONSTRAINT profiles_extracurriculars_len CHECK (
    array_length(extracurriculars, 1) IS NULL OR array_length(extracurriculars, 1) <= 50
  ),
  ADD CONSTRAINT profiles_certifications_len CHECK (
    array_length(certifications, 1) IS NULL OR array_length(certifications, 1) <= 50
  ),
  ADD CONSTRAINT profiles_languages_len CHECK (
    array_length(languages, 1) IS NULL OR array_length(languages, 1) <= 50
  ),
  ADD CONSTRAINT profiles_dream_colleges_len CHECK (
    array_length(dream_colleges, 1) IS NULL OR array_length(dream_colleges, 1) <= 50
  ),
  ADD CONSTRAINT profiles_target_colleges_len CHECK (
    array_length(target_colleges, 1) IS NULL OR array_length(target_colleges, 1) <= 50
  ),
  ADD CONSTRAINT profiles_safety_colleges_len CHECK (
    array_length(safety_colleges, 1) IS NULL OR array_length(safety_colleges, 1) <= 50
  );

ALTER TABLE public.cohorts
  ADD CONSTRAINT cohorts_name_len CHECK (char_length(btrim(name)) BETWEEN 2 AND 80);

ALTER TABLE public.community_posts
  ADD CONSTRAINT community_posts_title_len CHECK (char_length(btrim(title)) BETWEEN 3 AND 160),
  ADD CONSTRAINT community_posts_body_len CHECK (char_length(btrim(body)) BETWEEN 1 AND 5000),
  ADD CONSTRAINT community_posts_author_len CHECK (char_length(author_name) <= 80),
  ADD CONSTRAINT community_posts_category_len CHECK (char_length(category) <= 60);

ALTER TABLE public.community_replies
  ADD CONSTRAINT community_replies_body_len CHECK (char_length(btrim(body)) BETWEEN 1 AND 3000),
  ADD CONSTRAINT community_replies_author_len CHECK (char_length(author_name) <= 80);
