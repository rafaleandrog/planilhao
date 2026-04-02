#!/usr/bin/env node
import { spawn } from 'node:child_process';

function parseArgs(argv) {
  const args = { goal: '', dryRun: false };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--goal' || token === '-g') {
      args.goal = argv[i + 1] || '';
      i += 1;
      continue;
    }
    if (token === '--dry-run') {
      args.dryRun = true;
      continue;
    }
  }

  return args;
}

function buildPrompt(goal) {
  return [
    'Você é um agente Codex conectado ao repositório atual.',
    'Objetivo do usuário:',
    goal,
    '',
    'Regras obrigatórias:',
    '1) Revise os arquivos relevantes antes de alterar.',
    '2) Se precisar de banco, use o servidor MCP do Supabase já configurado no Codex.',
    '3) Faça mudanças pequenas e seguras, explicando em comentários de commit quando necessário.',
    '4) Rode os checks possíveis e corrija erros.',
    '5) Entregue patch final + resumo das alterações.',
    '',
    'Importante: não execute operações destrutivas em produção sem confirmação explícita.'
  ].join('\n');
}

async function runCodex(prompt) {
  const codexBin = process.env.CODEX_BIN || 'codex';
  const attemptedCommands = [
    [codexBin, ['run', '--full-auto', prompt]],
    [codexBin, ['exec', '--full-auto', prompt]],
    [codexBin, [prompt]]
  ];

  for (const [cmd, commandArgs] of attemptedCommands) {
    const exitCode = await new Promise((resolve) => {
      const child = spawn(cmd, commandArgs, {
        stdio: 'inherit',
        env: process.env
      });

      child.on('error', () => resolve(127));
      child.on('close', (code) => resolve(code ?? 1));
    });

    if (exitCode === 0) {
      return;
    }
  }

  throw new Error('Não foi possível invocar o Codex CLI. Defina CODEX_BIN com o caminho correto.');
}

async function main() {
  const { goal, dryRun } = parseArgs(process.argv.slice(2));

  if (!goal) {
    console.error('Uso: npm run codex:task -- --goal "descreva a tarefa" [--dry-run]');
    process.exit(1);
  }

  const prompt = buildPrompt(goal);

  if (dryRun) {
    console.log('\n===== PROMPT GERADO =====\n');
    console.log(prompt);
    console.log('\n===== FIM =====\n');
    return;
  }

  await runCodex(prompt);
}

main().catch((err) => {
  console.error(`❌ ${err.message}`);
  process.exit(1);
});
