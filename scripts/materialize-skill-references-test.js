#!/usr/bin/env node

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  materializeSkillReferences,
} = require('./materialize-skill-references');

function writeFile(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function makeFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-skills-references-test-'));
  const sourceRoot = path.join(root, 'source');
  const destinationRoot = path.join(root, 'installed-skills');

  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  writeFile(
    path.join(sourceRoot, 'skills', 'alpha-skill', 'SKILL.md'),
    '# Alpha\n\nSee `references/shared-checklist.md`.\n',
  );
  writeFile(
    path.join(sourceRoot, 'references', 'shared-checklist.md'),
    '# Shared checklist\n',
  );
  writeFile(
    path.join(sourceRoot, 'references', 'unused-checklist.md'),
    '# Unused checklist\n',
  );
  writeFile(
    path.join(destinationRoot, 'alpha-skill', 'SKILL.md'),
    '# Alpha\n\nSee `references/shared-checklist.md`.\n',
  );
  writeFile(
    path.join(destinationRoot, 'unrelated-skill', 'sentinel.txt'),
    'preserve me\n',
  );

  return { sourceRoot, destinationRoot };
}

test('materializes referenced files and preserves unrelated installed content', (t) => {
  const { sourceRoot, destinationRoot } = makeFixture(t);

  const result = materializeSkillReferences({ sourceRoot, destinationRoot });

  assert.deepEqual(result, {
    skillsChecked: 1,
    referencesChecked: 1,
    referencesCopied: 1,
  });
  assert.equal(
    fs.readFileSync(
      path.join(destinationRoot, 'alpha-skill', 'references', 'shared-checklist.md'),
      'utf8',
    ),
    '# Shared checklist\n',
  );
  assert.equal(
    fs.existsSync(
      path.join(destinationRoot, 'alpha-skill', 'references', 'unused-checklist.md'),
    ),
    false,
  );
  assert.equal(
    fs.readFileSync(path.join(destinationRoot, 'unrelated-skill', 'sentinel.txt'), 'utf8'),
    'preserve me\n',
  );
});

test('check mode rejects missing references and accepts a materialized install', (t) => {
  const { sourceRoot, destinationRoot } = makeFixture(t);

  assert.throws(
    () => materializeSkillReferences({ sourceRoot, destinationRoot, check: true }),
    /Reference integrity check failed.*shared-checklist\.md/s,
  );

  materializeSkillReferences({ sourceRoot, destinationRoot });

  assert.deepEqual(
    materializeSkillReferences({ sourceRoot, destinationRoot, check: true }),
    {
      skillsChecked: 1,
      referencesChecked: 1,
      referencesCopied: 0,
    },
  );
});

test('fails before writing when an installed skill points at a missing source reference', (t) => {
  const { sourceRoot, destinationRoot } = makeFixture(t);
  writeFile(
    path.join(destinationRoot, 'alpha-skill', 'SKILL.md'),
    '# Alpha\n\nSee `references/missing-checklist.md`.\n',
  );

  assert.throws(
    () => materializeSkillReferences({ sourceRoot, destinationRoot }),
    /Source reference does not exist.*missing-checklist\.md/s,
  );
  assert.equal(
    fs.existsSync(path.join(destinationRoot, 'alpha-skill', 'references')),
    false,
  );
});

test('repairs the planning and TDD references from the real source bundle', (t) => {
  const sourceRoot = path.resolve(__dirname, '..');
  const destinationRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'agent-skills-real-references-test-'),
  );
  t.after(() => fs.rmSync(destinationRoot, { recursive: true, force: true }));

  const cases = [
    ['planning-and-task-breakdown', 'definition-of-done.md'],
    ['test-driven-development', 'testing-patterns.md'],
  ];

  for (const [skillName] of cases) {
    writeFile(
      path.join(destinationRoot, skillName, 'SKILL.md'),
      fs.readFileSync(path.join(sourceRoot, 'skills', skillName, 'SKILL.md'), 'utf8'),
    );
  }

  const result = materializeSkillReferences({ sourceRoot, destinationRoot });

  assert.deepEqual(result, {
    skillsChecked: 2,
    referencesChecked: 2,
    referencesCopied: 2,
  });
  for (const [skillName, referenceName] of cases) {
    assert.equal(
      fs.readFileSync(
        path.join(destinationRoot, skillName, 'references', referenceName),
        'utf8',
      ),
      fs.readFileSync(path.join(sourceRoot, 'references', referenceName), 'utf8'),
    );
  }
});
