#!/usr/bin/env node

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REFERENCE_PATTERN = /\breferences\/[a-z0-9][a-z0-9-]*\.md\b/g;

function extractReferencePaths(content) {
  return [...new Set(content.match(REFERENCE_PATTERN) || [])].sort();
}

function filesMatch(source, destination) {
  if (!fs.existsSync(destination)) return false;
  return fs.readFileSync(source).equals(fs.readFileSync(destination));
}

function requireDirectory(directory, label) {
  if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
    throw new Error(`${label} directory does not exist: ${directory}`);
  }
}

function materializeSkillReferences({ sourceRoot, destinationRoot, check = false }) {
  const resolvedSource = path.resolve(sourceRoot);
  const resolvedDestination = path.resolve(destinationRoot);
  const sourceSkills = path.join(resolvedSource, 'skills');

  requireDirectory(sourceSkills, 'Source skills');
  requireDirectory(resolvedDestination, 'Destination skills');

  const operations = [];
  const sourceErrors = [];
  let skillsChecked = 0;

  const skillNames = fs.readdirSync(sourceSkills)
    .filter(name => fs.statSync(path.join(sourceSkills, name)).isDirectory())
    .sort();

  for (const skillName of skillNames) {
    const installedSkill = path.join(resolvedDestination, skillName);
    const installedSkillFile = path.join(installedSkill, 'SKILL.md');
    if (!fs.existsSync(installedSkillFile)) continue;

    skillsChecked += 1;
    const content = fs.readFileSync(installedSkillFile, 'utf8');

    for (const reference of extractReferencePaths(content)) {
      const source = path.join(resolvedSource, reference);
      const destination = path.join(installedSkill, reference);

      if (!fs.existsSync(source) || !fs.statSync(source).isFile()) {
        sourceErrors.push(
          `Source reference does not exist for ${skillName}: ${reference}`,
        );
        continue;
      }

      operations.push({ destination, reference, skillName, source });
    }
  }

  if (sourceErrors.length > 0) {
    throw new Error(sourceErrors.join('\n'));
  }

  if (check) {
    const integrityErrors = operations
      .filter(({ source, destination }) => !filesMatch(source, destination))
      .map(({ destination, reference, skillName }) => (
        `Missing or stale installed reference for ${skillName}: ${reference} (${destination})`
      ));

    if (integrityErrors.length > 0) {
      throw new Error(`Reference integrity check failed:\n${integrityErrors.join('\n')}`);
    }

    return {
      skillsChecked,
      referencesChecked: operations.length,
      referencesCopied: 0,
    };
  }

  let referencesCopied = 0;
  for (const { source, destination } of operations) {
    if (filesMatch(source, destination)) continue;
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
    referencesCopied += 1;
  }

  return {
    skillsChecked,
    referencesChecked: operations.length,
    referencesCopied,
  };
}

function usage() {
  return [
    'Usage: node scripts/materialize-skill-references.js --destination <skills-dir> [options]',
    '',
    'Options:',
    '  --source <repo-root>       Source checkout (defaults to this repository)',
    '  --destination <skills-dir> Installed standalone skills directory',
    '  --check                    Verify references without writing files',
    '  --help                     Show this help',
  ].join('\n');
}

function parseArgs(argv) {
  const options = {
    sourceRoot: path.resolve(__dirname, '..'),
    destinationRoot: null,
    check: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--check') {
      options.check = true;
    } else if (arg === '--help') {
      options.help = true;
    } else if (arg === '--source' || arg === '--destination') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`${arg} requires a path`);
      }
      index += 1;
      if (arg === '--source') options.sourceRoot = value;
      if (arg === '--destination') options.destinationRoot = value;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      console.log(usage());
      return;
    }
    if (!options.destinationRoot) {
      throw new Error('--destination is required');
    }

    const result = materializeSkillReferences(options);
    const action = options.check ? 'Verified' : 'Materialized';
    console.log(
      `${action} ${result.referencesChecked} reference use(s) across ` +
      `${result.skillsChecked} installed skill(s); copied ${result.referencesCopied}.`,
    );
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  extractReferencePaths,
  materializeSkillReferences,
  parseArgs,
};
