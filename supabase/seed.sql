-- VRUTSA FOUNDATION — reference data only.
-- No appointments, programmes, statistics or financial details are seeded:
-- those come from the foundation through the admin panel.

insert into public.states (name, code) values ('Tamil Nadu', 'TN') on conflict (name) do nothing;

-- The 38 districts of Tamil Nadu with approximate district-headquarters coordinates
-- (used only to place a marker on the map; adjust in Admin → Districts).
insert into public.districts (state_id, name, slug, lat, lng)
select s.id, d.name, d.slug, d.lat, d.lng
from public.states s, (values
  ('Ariyalur','ariyalur',11.14,79.08), ('Chengalpattu','chengalpattu',12.69,79.98),
  ('Chennai','chennai',13.08,80.27), ('Coimbatore','coimbatore',11.00,76.96),
  ('Cuddalore','cuddalore',11.75,79.77), ('Dharmapuri','dharmapuri',12.13,78.16),
  ('Dindigul','dindigul',10.36,77.98), ('Erode','erode',11.34,77.72),
  ('Kallakurichi','kallakurichi',11.74,78.96), ('Kancheepuram','kancheepuram',12.83,79.70),
  ('Kanniyakumari','kanniyakumari',8.18,77.43), ('Karur','karur',10.96,78.08),
  ('Krishnagiri','krishnagiri',12.52,78.21), ('Madurai','madurai',9.93,78.12),
  ('Mayiladuthurai','mayiladuthurai',11.10,79.65), ('Nagapattinam','nagapattinam',10.77,79.84),
  ('Namakkal','namakkal',11.22,78.17), ('Nilgiris','nilgiris',11.41,76.70),
  ('Perambalur','perambalur',11.23,78.88), ('Pudukkottai','pudukkottai',10.38,78.82),
  ('Ramanathapuram','ramanathapuram',9.37,78.83), ('Ranipet','ranipet',12.93,79.33),
  ('Salem','salem',11.66,78.15), ('Sivaganga','sivaganga',9.85,78.48),
  ('Tenkasi','tenkasi',8.96,77.32), ('Thanjavur','thanjavur',10.79,79.14),
  ('Theni','theni',10.01,77.48), ('Thoothukudi','thoothukudi',8.76,78.13),
  ('Tiruchirappalli','tiruchirappalli',10.79,78.70), ('Tirunelveli','tirunelveli',8.71,77.76),
  ('Tirupathur','tirupathur',12.50,78.56), ('Tiruppur','tiruppur',11.11,77.34),
  ('Tiruvallur','tiruvallur',13.14,79.91), ('Tiruvannamalai','tiruvannamalai',12.23,79.07),
  ('Tiruvarur','tiruvarur',10.77,79.64), ('Vellore','vellore',12.92,79.13),
  ('Viluppuram','viluppuram',11.94,79.49), ('Virudhunagar','virudhunagar',9.57,77.96)
) as d(name, slug, lat, lng)
where s.code = 'TN'
on conflict (slug) do nothing;

-- Operating defaults. Everything else is entered in Admin → Website content / Settings.
insert into public.foundation_settings (key, value) values
  ('org_name', 'Vrutsa Foundation'),
  ('publish_mode', 'approval'),
  ('donation_amounts', '500,1000,2500,5000'),
  ('international_donations', 'disabled')
on conflict (key) do nothing;
