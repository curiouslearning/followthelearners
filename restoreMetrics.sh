#!/usr/bin/bash
start=$1
end=$2

start=$(date -j -f '%Y-%m-%d' $start +%Y%m%d)
end=$(date -j -f '%Y-%m-%d' $end +%Y%m%d)

while [[ $start -le $end ]]
do
	echo $start
	node dashboard-metrics.js $start;
	start=$(date -j -v+1d -f '%Y%m%d' $start +%Y%m%d)
done
