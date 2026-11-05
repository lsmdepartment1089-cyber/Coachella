// ============================================================
//  EDIT THIS FILE ONLY. Everything on the website comes from here.
// ============================================================
window.CONFIG = {
  // Supabase > Project Settings > API
  SUPABASE_URL: 'https://tyoywjkehkzaknououir.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5b3l3amtlaGt6YWtub3VvdWlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4NDc0NzksImV4cCI6MjEwODQyMzQ3OX0.w0TE-kK68f4ZgYMZbbMemm4A-EHhshhjRYiJJ3xkmg4',

  // Event details
  partyName: "McDonald's Year End Party",
  eventDate: '2026-11-24T18:00:00+08:00',   // countdown target (+08:00 = Philippines time)
  when: 'November 24, 2026 | 6:00 PM',
  where: 'Terrazas De Teodora Pavilion and Resort | Santa Rosa',               // <- put the real venue here
  dress: 'Coachella fits: boho, fringe, sunnies, flower crowns.',

  // Optional: put your official logo file in the repo (e.g. 'logo.svg') and write its name here.
  // Leave empty to use the simple golden-arch drawing.
  logoUrl: '',

  // Schedule shown as the "lineup poster"
  lineup: [
    { time: '', : 'Gates open' },
    { time: '',  act: 'PepTalk' },
    { time: '',  act: 'Opening Prayer' },
    { time: '',  act: 'Introduction' },
    { time: '',  act: 'Opening Remarks' },
    { time: '',  act: 'Games and Activities' },
    { time: '',  act: 'Ramp' },
    { time: '',  act: 'Santa Rosa Got Talent' },
    { time: '',  act: 'Awarding and Recognition' },
    { time: '',  act: 'Raffle Draw' },
    { time: '',  act: 'Closing Remarks' },
  ],

  // Talent uploads (must match the bucket created by supabase_setup.sql)
  uploadBucket: 'talent-uploads',
  maxFiles: 5,
  maxFileMB: 50
};
