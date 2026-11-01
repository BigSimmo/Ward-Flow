export PATH=/opt/node24/bin:$PATH
cd "$(dirname "$0")"
node capture.cjs | tail -1
for t in ${TABS:-home caseload hospital referrals clinicians}; do node view.cjs v-$t.png $t ${SCHEME:-light} & done; wait
