// ============================================================
//  EDIT THIS FILE ONLY. Everything on the website comes from here.
// ============================================================
window.CONFIG = {
  // Supabase > Project Settings > API
  SUPABASE_URL: 'https://YOUR-PROJECT.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR-ANON-PUBLIC-KEY',

  // Event details
  partyName: "McDonald's Year End Party",
  eventDate: '2026-11-24T18:00:00+08:00',   // countdown target (+08:00 = Philippines time)
  when: 'November 24, 2026 | 6:00 PM',
  where: 'Terrazas de Teodora Pavilion and Resort | Santa Rosa',               // <- put the real venue here
  dress: 'Coachella fits: boho, fringe, sunnies, flower crowns. Red and yellow welcome!',

  // Optional: put your official logo file in the repo (e.g. 'logo.svg') and write its name here.
  // Leave empty to use the simple golden-arch drawing.
  logoUrl: '',

  // Schedule shown as the "lineup poster"
  lineup: [
    { time: '6:00 PM',  act: 'Gates open' },
    { time: '7:00 PM',  act: 'PepTalk' },
    { time: '8:00 PM - 12:00 AM', act: 'Enjoy the show' }
  ],

  // Talent uploads (must match the bucket created by supabase_setup.sql)
  uploadBucket: 'talent-uploads',
  maxFiles: 5,
  maxFileMB: 50
};
