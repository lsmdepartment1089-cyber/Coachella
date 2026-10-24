// ============================================================
//  EDIT THIS FILE ONLY. Everything on the website comes from here.
// ============================================================
window.CONFIG = {
  // Supabase > Project Settings > API
  SUPABASE_URL: 'https://tyoywjkehkzaknououir.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5b3l3amtlaGt6YWtub3VvdWlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4NDc0NzksImV4cCI6MjEwODQyMzQ3OX0.w0TE-kK68f4ZgYMZbbMemm4A-EHhshhjRYiJJ3xkmg4',

  // Event details
  partyName: "McDonald's Year End Party",
  eventDate: '2026-11-25T18:00:00+08:00',   // countdown target (+08:00 = Philippines time)
  when: 'November 25, 2026 | 6:00 PM',
  where: 'Place, Santa Rosa',               // <- put the real venue here
  dress: 'Coachella fits: boho, fringe, sunnies, flower crowns. Red and yellow welcome!',

  // Optional: put your official logo file in the repo (e.g. 'logo.svg') and write its name here.
  // Leave empty to use the simple golden-arch drawing.
  logoUrl: '',

  // Schedule shown as the "lineup poster"
  lineup: [
    { time: '6:00 PM',  act: 'Gates open' },
    { time: '7:00 PM',  act: 'Dinner and drinks' },
    { time: '8:00 PM',  act: 'Talent show' },
    { time: '10:00 PM', act: 'Raffle draw' },
    { time: '10:30 PM', act: 'Dance floor' }
  ],

  // Talent uploads (must match the bucket created by supabase_setup.sql)
  uploadBucket: 'talent-uploads',
  maxFiles: 5,
  maxFileMB: 50
};
