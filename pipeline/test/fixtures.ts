import type { ExportArchive } from '../ingest/archive.ts'

/** A small synthetic Letterboxd export exercising every join and edge case. No real user data. */
export const FIXTURE_FILES: Record<string, string> = {
  'profile.csv': `Date Joined,Username,Given Name,Family Name,Email Address,Location,Website,Bio,Pronoun,Favorite Films
2023-05-15,tester,Test,,,Somewhere,,"I like films.
// 5 Stars: perfect | 3 Stars: fine //",they/them,"https://boxd.it/AAA1, https://boxd.it/ZZZZ"
`,
  'watched.csv': `Date,Name,Year,Letterboxd URI
2023-05-15,Alpha,2020,https://boxd.it/AAA1
2023-05-15,Beta,1999,https://boxd.it/BBB2
2023-06-01,Fantastic Four,2015,https://boxd.it/FF15
2023-06-02,Fantastic Four,2005,https://boxd.it/FF05
2023-06-03,Gamma,2023,https://boxd.it/GGG3
`,
  'ratings.csv': `Date,Name,Year,Letterboxd URI,Rating
2023-05-15,Alpha,2020,https://boxd.it/AAA1,5
2024-01-01,Beta,1999,https://boxd.it/BBB2,3
2023-06-01,Fantastic Four,2015,https://boxd.it/FF15,1.5
2023-06-02,Fantastic Four,2005,https://boxd.it/FF05,2.5
`,
  'diary.csv': `Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date
2023-05-15,Alpha,2020,https://boxd.it/d001,4.5,,,2021-03-01
2023-05-15,Beta,1999,https://boxd.it/d002,3.5,,,2003-01-01
2023-06-01,Fantastic Four,2015,https://boxd.it/d003,1.5,,,2023-06-01
2023-06-02,Fantastic Four,2005,https://boxd.it/d004,2.5,,"cinema, imax",2023-06-02
2023-08-01,Alpha,2020,https://boxd.it/d005,5,Yes,,2023-07-01
`,
  'reviews.csv': `Date,Name,Year,Letterboxd URI,Rating,Rewatch,Review,Tags,Watched Date
2023-08-01,Alpha,2020,https://boxd.it/d005,5,Yes,"Great stuff.
Loved the score, gorgeous visuals!",,2023-07-01
2023-06-01,Fantastic Four,2015,https://boxd.it/d003,1.5,,"Why did I do this? Boring and messy, but fun at times.",,2023-06-01
`,
  'watchlist.csv': `Date,Name,Year,Letterboxd URI
2023-05-20,Delta,1972,https://boxd.it/DDD4
2023-05-21,Epsilon,2030,https://boxd.it/EEE5
`,
  'likes/films.csv': `Date,Name,Year,Letterboxd URI
2023-05-15,Alpha,2020,https://boxd.it/AAA1
`,
  'likes/reviews.csv': `Date,Content
2023-05-26,https://boxd.it/xyz
`,
  'likes/lists.csv': `Date,Content
`,
  'comments.csv': `Date,Content,Comment
`,
  'lists/best.csv': `Letterboxd list export v7
Date,Name,Tags,URL,Description
2024-01-01,Best Ranked,,https://boxd.it/LLL1,"Mine,
with a comma"

Position,Name,Year,URL,Description
1,Alpha,2020,https://boxd.it/AAA1,
2,Delta,1972,https://boxd.it/DDD4,
`,
  'orphaned/diary.csv': `Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date
2024-12-08,Some TV Special,2024,,3.5,,,2024-12-07
`,
  'orphaned/reviews.csv': `Date,Name,Year,Letterboxd URI,Rating,Rewatch,Review,Tags,Watched Date
2024-12-08,Some TV Special,2024,,3.5,,Great show.,,2024-12-07
`,
  'deleted/diary.csv': `Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date
`,
}

export function fixtureArchive(overrides: Record<string, string> = {}): ExportArchive {
  return {
    path: '/tmp/letterboxd-tester-2026-01-02-03-04-utc.zip',
    sha256: 'fixture',
    files: new Map(Object.entries({ ...FIXTURE_FILES, ...overrides })),
  }
}
