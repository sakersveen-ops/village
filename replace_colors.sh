#!/bin/bash
# Replaces hardcoded terracotta/brown colors with teal design system equivalents
# Run from project root: bash replace_colors.sh ./src

TARGET="${1:-./src}"

echo "🎨 Replacing terracotta colors in: $TARGET"
echo ""

replace() {
  local from="$1"
  local to="$2"
  local escaped_from=$(printf '%s\n' "$from" | sed 's/[[\.*^$()+?{|]/\\&/g')
  local count=$(grep -rl "$from" "$TARGET" --include="*.tsx" --include="*.ts" --include="*.css" | wc -l)
  if [ "$count" -gt 0 ]; then
    grep -rl "$from" "$TARGET" --include="*.tsx" --include="*.ts" --include="*.css" \
      | xargs sed -i "s/$escaped_from/$to/g"
    echo "  ✓ '$from' → '$to'  ($count files)"
  fi
}

echo "── Hex colors ──────────────────────────────────────────"
# Primary terracotta → teal
replace "#C4673A"   "var(--terra)"
replace "#c4673a"   "var(--terra)"
replace "#2C1A0E"   "var(--terra-dark)"
replace "#2c1a0e"   "var(--terra-dark)"
replace "#6B4226"   "#1A3542"
replace "#6b4226"   "#1a3542"
replace "#9C7B65"   "var(--terra-mid)"
replace "#9c7b65"   "var(--terra-mid)"
replace "#FAF7F2"   "var(--glass-bg-heavy)"
replace "#faf7f2"   "var(--glass-bg-heavy)"
replace "#E8DDD0"   "var(--glass-border)"
replace "#e8ddd0"   "var(--glass-border)"
replace "#1F4E5C"   "#163d4a"
replace "#1f4e5c"   "#163d4a"

echo ""
echo "── rgba terracotta (196,103,58) → teal (46,98,113) ─────"
replace "rgba(196,103,58,0.10)"  "rgba(46,98,113,0.10)"
replace "rgba(196,103,58,0.12)"  "rgba(46,98,113,0.12)"
replace "rgba(196,103,58,0.15)"  "rgba(46,98,113,0.15)"
replace "rgba(196,103,58,0.18)"  "rgba(46,98,113,0.18)"
replace "rgba(196,103,58,0.20)"  "rgba(46,98,113,0.20)"
replace "rgba(196,103,58,0.25)"  "rgba(46,98,113,0.25)"
replace "rgba(196,103,58,0.30)"  "rgba(46,98,113,0.30)"
replace "rgba(196,103,58,0.35)"  "rgba(46,98,113,0.35)"
replace "rgba(196,103,58,0.40)"  "rgba(46,98,113,0.40)"
replace "rgba(196,103,58,0.45)"  "rgba(46,98,113,0.45)"
replace "rgba(196,103,58,0.50)"  "rgba(46,98,113,0.50)"
replace "rgba(196,103,58,0.55)"  "rgba(46,98,113,0.55)"
replace "rgba(196,103,58,0.60)"  "rgba(46,98,113,0.60)"
replace "rgba(196,103,58,0.65)"  "rgba(46,98,113,0.65)"
replace "rgba(196,103,58,0.70)"  "rgba(46,98,113,0.70)"
replace "rgba(196,103,58,0.75)"  "rgba(46,98,113,0.75)"
replace "rgba(196,103,58,0.80)"  "rgba(46,98,113,0.80)"
replace "rgba(196,103,58,0.9)"   "rgba(46,98,113,0.9)"

echo ""
echo "── rgba brown (26,37,48) shadows – keep as-is (already teal-dark) ──"
echo "  (skipping – these are already correct)"

echo ""
echo "── Tailwind hardcoded classes ───────────────────────────"
replace "bg-\[#C4673A\]"   "bg-[var(--terra)]"
replace "bg-\[#FAF7F2\]"   "bg-[var(--glass-bg-heavy)]"
replace "text-\[#C4673A\]" "text-[var(--terra)]"
replace "text-\[#2C1A0E\]" "text-[var(--terra-dark)]"
replace "text-\[#9C7B65\]" "text-[var(--terra-mid)]"
replace "border-\[#C4673A\]" "border-[var(--terra)]"
replace "border-\[#E8DDD0\]" "border-[var(--glass-border)]"
replace "focus:border-\[#C4673A\]" "focus:border-[var(--terra)]"
replace "hover:border-\[#C4673A\]" "hover:border-[var(--terra)]"
replace "hover:text-\[#C4673A\]"   "hover:text-[var(--terra)]"

echo ""
echo "── CSS fallback values in var() ─────────────────────────"
replace "var(--terra, #C4673A)"      "var(--terra)"
replace "var(--terra, #c4673a)"      "var(--terra)"
replace "var(--terra-dark, #2C1A0E)" "var(--terra-dark)"
replace "var(--terra-dark,#2C1A0E)"  "var(--terra-dark)"
replace "var(--terra-dark, #2c1a0e)" "var(--terra-dark)"

echo ""
echo "── Login page gradient ──────────────────────────────────"
replace "linear-gradient(160deg, #2C1A0E 0%, #6B4226 55%, #C4673A 100%)" \
        "linear-gradient(160deg, #0D1E25 0%, #1A3542 50%, #2E6271 100%)"

echo ""
echo "✅ Done! Review changes with: git diff src/"
echo "   Undo everything with:      git checkout src/"
