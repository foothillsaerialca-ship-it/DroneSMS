create table if not exists public.hazard_library (
  id uuid primary key default gen_random_uuid(),
  hazard_name text not null,
  category text not null,
  default_mitigation text not null,
  service_types text[] not null default '{}',
  is_universal boolean not null default false,
  is_system_hazard boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists hazard_library_hazard_name_key on public.hazard_library (lower(hazard_name));
create index if not exists hazard_library_service_types_idx on public.hazard_library using gin (service_types);
create index if not exists hazard_library_is_universal_idx on public.hazard_library (is_universal);
create index if not exists hazard_library_category_idx on public.hazard_library (category);

alter table public.hazard_library enable row level security;

drop policy if exists "Authenticated users can view system hazard library" on public.hazard_library;
create policy "Authenticated users can view system hazard library"
  on public.hazard_library
  for select
  to authenticated
  using (is_system_hazard = true);

grant select on public.hazard_library to authenticated;

insert into public.hazard_library (hazard_name, category, default_mitigation, service_types, is_universal, is_system_hazard)
select hazard_name, category, default_mitigation, service_types, is_universal, true
from (
  values
    ('Airspace Restrictions', 'Airspace', 'Review current airspace, TFRs, NOTAMs, and site restrictions before flight. Confirm the mission remains inside approved operating limits before launch.', '{}'::text[], true),
    ('Weather Conditions', 'Environmental', 'Review forecast and on-site weather before operations. Delay or stop work when precipitation, visibility, temperature, or other weather conditions exceed aircraft or crew limits.', '{}'::text[], true),
    ('Wind Conditions', 'Environmental', 'Check forecast and on-site wind at the operating area. Operate within aircraft limits and pause operations if gusts or direction changes reduce control margins.', '{}'::text[], true),
    ('Wildlife Activity', 'Environmental', 'Scan the area for wildlife before launch. Avoid disturbing animals and pause operations if wildlife enters the work area.', '{}'::text[], true),
    ('Pedestrian Traffic', 'Ground / Site', 'Establish a controlled work area with cones, signage, barriers, or a ground monitor where needed. Pause operations if pedestrians enter the operating area.', '{}'::text[], true),
    ('Vehicle Traffic', 'Ground / Site', 'Separate the operation from vehicle paths. Use spotters or traffic controls where appropriate and pause flight when vehicles enter the operating area.', '{}'::text[], true),
    ('Power Lines', 'Infrastructure', 'Identify and brief power line locations before launch. Maintain conservative standoff distance and use visual observer support when operating near utilities.', '{}'::text[], true),
    ('Loss of Link', 'Aircraft / Systems', 'Confirm control link quality, return-to-home settings, lost-link behavior, and emergency landing areas before flight. Brief crew on lost-link response.', '{}'::text[], true),
    ('Battery Failure', 'Aircraft / Systems', 'Inspect batteries before use, verify charge state and health, and set conservative return and landing thresholds. Keep spare batteries managed and protected.', '{}'::text[], true),
    ('Crew Communication Failure', 'Crew Coordination', 'Brief communication roles, hand signals, radio channels, and lost-communication procedures before work begins. Stop operations if crew coordination is lost.', '{}'::text[], true),

    ('Water Runoff', 'Cleaning Operations', 'Identify runoff paths before work. Control or capture wash water where required and prevent uncontrolled discharge from the operating area.', array['Cleaning Operations']::text[], false),
    ('Storm Drain Nearby', 'Cleaning Operations', 'Locate storm drains before work. Use drain protection where required and prevent wash water or chemicals from entering drains.', array['Cleaning Operations']::text[], false),
    ('Overspray', 'Cleaning Operations', 'Identify overspray exposure areas. Protect people, vehicles, sensitive surfaces, and adjacent properties. Adjust spray pattern or pause for wind.', array['Cleaning Operations']::text[], false),
    ('Hose / Tether Snag', 'Cleaning Operations', 'Assign ground crew for hose or tether management. Keep lines clear of pedestrians, vehicles, vegetation, structures, and aircraft flight paths.', array['Cleaning Operations']::text[], false),
    ('Sensitive Landscaping', 'Cleaning Operations', 'Identify sensitive plants, soil areas, and irrigation components. Limit overspray and runoff exposure with barriers or alternate workflow as needed.', array['Cleaning Operations']::text[], false),
    ('Building Occupants', 'Cleaning Operations', 'Coordinate with the client before work. Keep occupants clear of affected doors, windows, balconies, and work zones during cleaning operations.', array['Cleaning Operations']::text[], false),
    ('Public Roadway Exposure', 'Ground / Site', 'Maintain safe standoff from roadways. Prevent equipment, aircraft, debris, or runoff from entering traffic lanes and use a ground monitor near public access points.', array['Cleaning Operations','Roof Inspection','Agricultural','Mapping / Surveying','Real Estate / Property Media']::text[], false),

    ('Roof Access', 'Working at Height', 'Coordinate safe roof access with the client or site representative. Keep drone crew away from unprotected edges unless qualified controls are in place.', array['Thermal Inspection','Roof Inspection']::text[], false),
    ('Early Morning / Low Light Operations', 'Environmental', 'Confirm lighting is sufficient for safe setup, visual line of sight, obstacle awareness, and crew movement. Use supplemental lighting where appropriate.', array['Thermal Inspection']::text[], false),
    ('Heat Loading on Aircraft', 'Aircraft / Systems', 'Monitor aircraft, payload, and battery temperature limits. Plan rest periods and avoid extended operations when thermal loading reduces safe margins.', array['Thermal Inspection']::text[], false),
    ('Visual Line of Sight Limitations', 'Flight Operations', 'Plan flight paths that preserve unaided visual line of sight. Use visual observers, reposition launch points, or reduce mission scope when needed.', array['Thermal Inspection','Mapping / Surveying','Real Estate / Property Media']::text[], false),
    ('Controlled Airspace', 'Airspace', 'Review airspace classification and determine whether LAANC or additional authorization is required. Confirm authorization before flight and brief limits.', array['Thermal Inspection','Agricultural','Mapping / Surveying','Construction Progress']::text[], false),

    ('Ladder Use', 'Working at Height', 'Use ladders only when necessary and in accordance with site safety practices. Maintain three points of contact and keep drone tasks separate from ladder movement.', array['Roof Inspection']::text[], false),
    ('Fall Hazard', 'Working at Height', 'Identify fall exposures before work. Maintain safe distance from roof edges and coordinate with qualified personnel for any work requiring fall protection.', array['Roof Inspection']::text[], false),
    ('Fragile Roofing Materials', 'Working at Height', 'Identify fragile roof materials before access or close inspection. Avoid contact and document areas that require special handling or client controls.', array['Roof Inspection']::text[], false),
    ('Heat Stress', 'Environmental', 'Plan hydration, shade, and rest breaks. Monitor crew for heat stress symptoms and stop work when conditions become unsafe.', array['Roof Inspection']::text[], false),

    ('Chemical Exposure', 'Agricultural', 'Review chemical application history and SDS information when available. Use required PPE and avoid contact with treated areas until safe entry is confirmed.', array['Agricultural']::text[], false),
    ('Livestock Activity', 'Agricultural', 'Coordinate with the landowner regarding livestock location and behavior. Maintain distance and pause operations if animals become stressed or enter the work area.', array['Agricultural']::text[], false),
    ('Wind Drift', 'Agricultural', 'Evaluate wind direction and drift potential before flight. Adjust operating area or delay work when drift could affect people, property, crops, or livestock.', array['Agricultural']::text[], false),
    ('Irrigation Equipment', 'Agricultural', 'Identify pivots, pumps, risers, hoses, and lines before launch. Maintain clearance and coordinate with the landowner before operating near active equipment.', array['Agricultural']::text[], false),
    ('Remote Operating Area', 'Agricultural', 'Confirm communications, access, emergency response location, and battery logistics for remote sites. Brief crew on check-in and emergency procedures.', array['Agricultural']::text[], false),

    ('Extended Flight Operations', 'Flight Operations', 'Plan battery rotations, crew breaks, data capture intervals, and emergency landing options. Monitor fatigue and aircraft status throughout the mission.', array['Mapping / Surveying']::text[], false),
    ('Multiple Takeoff Locations', 'Flight Operations', 'Assess each launch and recovery area before use. Re-brief hazards, airspace, emergency landing areas, and crew positions when relocating.', array['Mapping / Surveying']::text[], false),
    ('Battery Management', 'Aircraft / Systems', 'Track battery assignment, charge state, temperature, and cycle condition. Use conservative reserves for mapping legs and recovery to the launch area.', array['Mapping / Surveying']::text[], false),
    ('Public Access Areas', 'Ground / Site', 'Identify trails, parks, sidewalks, and other public access points. Use signs, cones, observers, or alternate timing to keep people clear of operations.', array['Mapping / Surveying']::text[], false),
    ('Terrain Obstacles', 'Ground / Site', 'Review terrain, trees, slopes, towers, and other obstacles before flight. Set safe altitudes and update flight paths as terrain changes.', array['Mapping / Surveying']::text[], false),

    ('Cranes', 'Construction Progress', 'Coordinate with site supervision regarding crane location and movement. Maintain standoff distance and stop operations during conflicting crane activity.', array['Construction Progress']::text[], false),
    ('Suspended Loads', 'Construction Progress', 'Avoid flight and crew activity near suspended loads. Coordinate timing with site supervision and pause operations when lifting activity is present.', array['Construction Progress']::text[], false),
    ('Active Equipment', 'Construction Progress', 'Identify active equipment routes and exclusion zones. Maintain separation from moving machinery and use a site escort or observer when needed.', array['Construction Progress']::text[], false),
    ('Multiple Contractors', 'Construction Progress', 'Coordinate with the site supervisor and communicate planned drone activity to affected contractors. Reassess hazards as work crews change.', array['Construction Progress']::text[], false),
    ('Dust', 'Construction Progress', 'Monitor dust that could affect visibility, aircraft systems, or crew exposure. Delay or reposition operations when dust reduces safe margins.', array['Construction Progress']::text[], false),
    ('Dynamic Work Area', 'Construction Progress', 'Treat the site as changing throughout the mission. Reassess traffic, equipment, personnel, and obstacles before each flight segment.', array['Construction Progress']::text[], false),

    ('Privacy Concerns', 'Real Estate / Property Media', 'Review camera angles, neighboring properties, and client expectations before flight. Avoid unnecessary capture of private areas and follow applicable privacy requirements.', array['Real Estate / Property Media']::text[], false)
) as seed(hazard_name, category, default_mitigation, service_types, is_universal)
where not exists (
  select 1
  from public.hazard_library existing
  where lower(existing.hazard_name) = lower(seed.hazard_name)
);
