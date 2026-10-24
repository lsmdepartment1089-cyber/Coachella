# Coachella: Beyond the Arches — McDonald's Year End Party

Interactive invitation: nickname login, raffle number reveal (1 re-roll), countdown, RSVP,
talent sign-up with file uploads, and an organizer desk with Excel export.

## Files in this repo
| File | What it is |
|---|---|
| `index.html` | The website (design + logic) |
| `config.js` | **The only file you edit**: Supabase keys, date, venue, schedule |
| `supabase_setup.sql` | Database + storage setup, run once in Supabase |
| `favicon.svg` | Browser tab icon |

## Deploy in 5 steps
1. **Supabase**: open your project > *SQL Editor* > *New query*. Open `supabase_setup.sql`,
   **change the password** on the line marked `CHANGE ME`, paste everything, press *Run*.
2. **Keys**: Supabase > *Project Settings* > *API*. Copy the *Project URL* and the *anon public* key
   into `config.js`. Also write the real venue in `where`.
3. **GitHub**: upload all files in this folder to a repository (keep them in the root).
4. **Vercel**: *Add New > Project* > import the repository > *Deploy*. No build settings needed.
5. **Test**: open the site, enter a nickname, get a raffle number, save a talent entry.

## Organizer desk
Open `your-site.vercel.app/#admin` (or the small "Organizer login" link) and enter the password.
You see every guest with raffle number, RSVP, talent entry and file links, plus a
**Download Excel** button (sheets: Guests and Performers).

## Good to know
- Nickname = login. Anyone who knows a nickname can open that guest's page.
- Raffle numbers are assigned inside Supabase, so two guests never get the same one.
- Uploaded files are stored in the `talent-uploads` bucket (50 MB each on the free plan).
  The links are unguessable and only shown in the organizer desk.
- Change the organizer password later in SQL Editor:
  `update admin_config set value = 'new-password' where key = 'admin_password';`
- To use your official McDonald's logo, add the file (e.g. `logo.svg`) to the repo and set `logoUrl: 'logo.svg'` in `config.js`.
