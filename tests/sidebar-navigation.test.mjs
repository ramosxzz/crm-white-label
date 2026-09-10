import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("sidebar usa accordion controlado e abre o grupo da rota atual", async () => {
  const source = await readFile("components/app/sidebar.tsx", "utf8");
  assert.match(source, /const \[openGroupId, setOpenGroupId\]/);
  assert.match(source, /if \(activeGroupId\) setOpenGroupId\(activeGroupId\)/);
  assert.match(source, /open=\{openGroupId === group\.id\}/);
  assert.doesNotMatch(source, /NAV_GROUP_COLORS/);
});

test("sidebar mobile reutiliza os mesmos grupos e possui dialog acessivel", async () => {
  const source = await readFile("components/app/sidebar.tsx", "utf8");
  assert.match(source, /<DialogPrimitive\.Root open=\{mobileOpen\}/);
  assert.match(source, /<DialogPrimitive\.Title className="sr-only">Menu principal/);
  assert.match(source, /navGroups\.map\(\(group\) =>/);
  assert.match(source, /onNavigate=\{\(\) => setMobileOpen\(false\)\}/);
});
