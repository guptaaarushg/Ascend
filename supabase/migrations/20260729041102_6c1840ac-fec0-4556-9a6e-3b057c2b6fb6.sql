ALTER TABLE public.user_opportunities
  ADD CONSTRAINT user_opportunities_notes_len
  CHECK (notes IS NULL OR char_length(notes) <= 2000);

ALTER TABLE public.opportunities
  ADD CONSTRAINT opportunities_title_len CHECK (char_length(btrim(title)) BETWEEN 3 AND 200),
  ADD CONSTRAINT opportunities_org_len CHECK (char_length(btrim(organization)) BETWEEN 2 AND 160),
  ADD CONSTRAINT opportunities_category_len CHECK (char_length(category) <= 60),
  ADD CONSTRAINT opportunities_description_len CHECK (char_length(description) <= 8000),
  ADD CONSTRAINT opportunities_eligibility_len CHECK (char_length(eligibility) <= 4000),
  ADD CONSTRAINT opportunities_location_len CHECK (location IS NULL OR char_length(location) <= 160),
  ADD CONSTRAINT opportunities_url_len CHECK (url IS NULL OR (char_length(url) <= 2048 AND url ~* '^https?://')),
  ADD CONSTRAINT opportunities_equipment_len CHECK (equipment_needed IS NULL OR char_length(equipment_needed) <= 1000),
  ADD CONSTRAINT opportunities_tags_len CHECK (array_length(tags, 1) IS NULL OR array_length(tags, 1) <= 30),
  ADD CONSTRAINT opportunities_skills_len CHECK (array_length(related_skills, 1) IS NULL OR array_length(related_skills, 1) <= 30),
  ADD CONSTRAINT opportunities_pathways_len CHECK (array_length(pathway_unlocks, 1) IS NULL OR array_length(pathway_unlocks, 1) <= 30);