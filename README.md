# eGirlskey

This repo holds the version of [Misskey](https://github.com/misskey-dev/misskey)
currently running on [egirls.gay](https://egirls.gay). Originally based off the
[Pluskey](https://github.com/foggy-llc/pluskey) fork.

The `egirls-live` holds the version of Misskey currently running.

A non-comprehensive list of changes:

- Web client API now requires sign-in to view posts and users (pages still visible)
- Some hard-coded limits are bumped higher (NOTE: requires manual DB alteration)
- @ mentions are included by the client even for replies to local users (gated behind
  `localMentions` registry key)
- `keepCw` defaults to true
- Default themes are changed to a custom pink/dark pink theme.
- The (english) names for note, renote, follower, and mentions are changed to
  stream, raid, simp, and ping respectively.
- You can pin other users' posts.
- The Instance menu no longer defaults to the overview panel on large screens.
- Some changes to image caption federation
- Silence and suspended notices are added to account pages for moderators.

