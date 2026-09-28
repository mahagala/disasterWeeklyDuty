#!/usr/bin/env bash
# 檢查本機開發環境（Intel 與 Apple 晶片 Mac 皆適用）
# 用法：bash scripts/check_env.sh
set -u

ok=0
arch=$(uname -m)
if [ "$arch" = "arm64" ]; then
  chip="Apple 晶片"; brew_prefix="/opt/homebrew"
else
  chip="Intel 晶片"; brew_prefix="/usr/local"
fi
if [ "$arch" = "x86_64" ] && [ "$(sysctl -in sysctl.proc_translated 2>/dev/null)" = "1" ]; then
  chip="Apple 晶片（目前終端機以 Rosetta 執行）"; brew_prefix="/opt/homebrew"
fi
echo "晶片：$chip，Homebrew 應在 $brew_prefix"

# Homebrew
if [ -x "$brew_prefix/bin/brew" ]; then
  echo "✓ Homebrew：$("$brew_prefix/bin/brew" --version 2>/dev/null | head -1)"
else
  echo "✗ 找不到 $brew_prefix/bin/brew，請先安裝 Homebrew：https://brew.sh"
  ok=1
fi

# Node.js 22+
if command -v node >/dev/null 2>&1; then
  node_ver=$(node --version 2>/dev/null)
  node_major=${node_ver#v}; node_major=${node_major%%.*}
  if [ "${node_major:-0}" -ge 22 ] 2>/dev/null; then
    echo "✓ Node.js $node_ver（$(command -v node)）"
  else
    echo "✗ Node.js $node_ver 太舊（$(command -v node)），需要 22 以上"
    echo "  安裝：$brew_prefix/bin/brew install node@22"
    echo "  並在 ~/.zshrc 最後加上：export PATH=\"$brew_prefix/opt/node@22/bin:\$PATH\""
    ok=1
  fi
else
  echo "✗ 找不到 node，安裝：$brew_prefix/bin/brew install node@22"
  ok=1
fi

# Python 3.9+（依序找 python3.13 / 3.12 / 3.11 / 3.10 / 3.9 / python3）
py=""
for cand in python3.13 python3.12 python3.11 python3.10 python3.9 python3; do
  if command -v "$cand" >/dev/null 2>&1 && "$cand" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)' 2>/dev/null; then
    py=$cand; break
  fi
done
if [ -n "$py" ]; then
  echo "✓ Python：請用 $py（$("$py" --version 2>&1)，$(command -v "$py")）"
  if [ "$py" != "python3" ]; then
    echo "  注意：預設 python3 是 $(python3 --version 2>&1)，本專案請改打 $py"
  fi
else
  echo "✗ 找不到 Python 3.9 以上，安裝：$brew_prefix/bin/brew install python@3.12"
  ok=1
fi

# Git 狀態：兩台電腦輪流開發時最容易出問題的地方
if git rev-parse --git-dir >/dev/null 2>&1; then
  git fetch -q 2>/dev/null
  behind=$(git rev-list --count HEAD..@{u} 2>/dev/null || echo "?")
  if [ "$behind" != "0" ]; then
    echo "! 本機落後 GitHub $behind 筆 commit，開始修改前請先 git pull"
  else
    echo "✓ Git 已與 GitHub 同步"
  fi
  if ! git diff --quiet -- data/ 2>/dev/null; then
    echo "! data/ 有本機改動（多半是在本機跑過 update_feeds.py），請用 git checkout -- data/ 還原"
  fi
fi

[ $ok -eq 0 ] && echo "環境檢查通過" || echo "環境有問題，請依上方提示處理"
exit $ok
