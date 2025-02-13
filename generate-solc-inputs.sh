#!/bin/bash
rm out/build-info/*
work_dir="out/build-info"
contracts=("PoseidonT3" "PrivacyToken" "KeyRegistry")
for contract in "${contracts[@]}"; do
  forge build --build-info "contracts/$contract.sol"
  latest_build_info=$(ls -t $work_dir | head -n 1)
  out_file="$work_dir/input-$contract.json"
  # Strip out the unused data from the input object
  node -e "const {input:{language,sources,settings}} = require('./$work_dir/$latest_build_info'); console.log(JSON.stringify({language,sources,settings}, null, 2))" > $out_file
done
