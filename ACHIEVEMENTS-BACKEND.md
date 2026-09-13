# Achievement backend progress

- Separate schema `apps/api/src/db/achievement-schema.ts`, generated migration `0005_far_ma_gnuci.sql` includes actual pickup field and preserves loyalty migration.
- Shared validated contract exported from `packages/shared/src/achievements.ts`.
- 34 Portuguese defaults, 11 metrics, four difficulties. Defaults grant XP only; optional administrator-configured coins are bounded. XP has six levels and is never spendable currency.
- Only delivered orders count toward purchasing, spending, variety, calendar and earned-coins metrics. Calendar uses order date in America/Sao_Paulo, without streak resets. Cancelled reward redemptions do not count. Bonuses excluded from earned-coins metric to prevent feedback loops.
- Real pickup field integration coordinated with pickup agent. Capability follows store setting and pickup achievements stay hidden when feature unavailable, preserving already awarded ones.
- Reconciliation occurs on customer GET and delivered-order events; missed events repaired at next visit. No runtime DDL. Defaults insert once/process using unique slug conflicts, preserving admin edits and archives.
- Immutable award snapshots survive administrative changes/archive. Unique customer/achievement constraint and customer row lock shared with loyalty protect atomic, once-only optional coin credit.
- Admin create/update/archive, aggregate stats, paginated searchable recipient audit. Customer acknowledgement is user-scoped and idempotent.
- API typecheck passed after implementation; pure rule test file covers defaults, monetary boundaries, metric isolation, validation and XP level boundaries.
- Limitation: variety uses current product categories and non-deleted product IDs because historical category snapshots are not present in existing order items. Previously granted awards remain preserved.
- Pending: full integration exercise with migrated database managed by root; UI integration managed by other agents.
