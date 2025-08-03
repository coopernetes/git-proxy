#!/usr/bin/env bash
set -x
_maxthreads=${1:-50}
_runs=${2:-5}
_host=${3:-localhost}
_port=${4:-8000}
_basePath=${5:-""}

echo "Running fetch performance tests to maximum of ${_maxthreads} threads, ${_runs} runs for http://${_host}:${_port}${_basePath}"

for _t in $(seq 10 10 "${_maxthreads}"); do
  _dir="${_t}t"

  mkdir -p "perf_results/fetch/${_dir}"

  jmeter -n -t fetch.jmx \
    -Jhost="${_host}" \
    -Jport="${_port}" \
    -JbasePath="${_basePath}" \
    -Jthreads="${_t}" \
    -Jruns="${_runs}" \
    -l "perf_results/${_dir}/result" \
    -e -o "perf_results/${_dir}/report"
done


echo "Running push performance tests to maximum of ${_maxthreads} threads, ${_runs} runs for http://${_host}:${_port}${_basePath}"

for _t in $(seq 10 10 "${_maxthreads}"); do
  _dir="${_t}t"

  mkdir -p "perf_results/push/${_dir}"

  jmeter -n -t push.jmx \
    -Jhost="${_host}" \
    -Jport="${_port}" \
    -JbasePath="${_basePath}" \
    -Jthreads="${_t}" \
    -Jruns="${_runs}" \
    -l "perf_results/${_dir}/result" \
    -e -o "perf_results/${_dir}/report"
done
