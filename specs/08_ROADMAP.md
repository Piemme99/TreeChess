# Roadmap: Execution Order

**Version:** 1.0
**Date:** January 19, 2026

---

## Execution Order

| Phase | Epics | Duration | Status |
|-------|-------|----------|--------|
| 1. Foundations | Epic 1 (Infrastructure) | 1-2 days | - |
| 2. Backend | Epic 2 (Backend API), Epic 3 (Chess Logic) | 6-8 days | - |
| 3. Frontend Core | Epic 4 (Frontend Core), Epic 4b (Board) | 5-7 days | - |
| 4. Visualization | Epic 5 (Tree), Epic 6 (CRUD) | 7-9 days | - |
| 5. Workflow | Epic 7 (PGN Import) | 3-4 days | - |
| 6. Polish | Integration | 2-3 days | - |

**Total: ~24-33 days**

---

## Dependencies Matrix

| Epic | Depends On |
|------|------------|
| Epic 1 (Infrastructure) | None |
| Epic 2 (Backend API) | Epic 1 |
| Epic 3 (Chess Logic) | None (parallel) |
| Epic 4 (Frontend Core) | Epic 1, Epic 3 |
| Epic 4b (Board) | Epic 4 |
| Epic 5 (Tree) | Epic 4b |
| Epic 6 (CRUD) | Epic 5, Epic 4b |
| Epic 7 (PGN Import) | Epic 6, Epic 3 |

---

## Parallel Development

Epic 1 and Epic 3 can be developed in parallel during Week 1.

---

## Milestones

| Milestone | Description | Target |
|-----------|-------------|--------|
| M1 | Infrastructure running | Day 2 |
| M2 | Backend API functional | Day 7 |
| M3 | Board component working | Day 14 |
| M4 | Tree visualization working | Day 21 |
| M5 | Full CRUD working | Day 28 |
| M6 | PGN import working | Day 32 |
| M7 | MVP complete | Day 35 |

---

## Parallel Development Schedule

```
Week 1: Epic 1 (Infrastructure) + Epic 3 (Chess Logic)
Week 2: Epic 2 (Backend API)
Week 3: Epic 4 (Frontend Core) + Backend testing
Week 4: Epic 4b (Board) + Epic 5 (Tree)
Week 5: Epic 6 (CRUD)
Week 6: Epic 7 (PGN Import)
Week 7: Integration + Polish
```

---

## Definition of "Done"

A feature is considered "done" when:
1. Code is written and reviewed
2. Tests pass (50% coverage target for backend)
3. Verified manually in browser
4. No blocking bugs
