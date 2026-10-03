import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
it("preserves stable-task freshness, completion and repository boundaries offline", () => {
  const exporter = fileURLToPath(new URL("../scripts/export-task-receipt.py", import.meta.url));
  const code = String.raw`
import importlib.util, tempfile, datetime, json, pathlib, subprocess, sys
spec=importlib.util.spec_from_file_location('receipt',sys.argv[1]); module=importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
head='a'*40
remote=['https://github.com/BigSimmo/Ward-Flow.git']
history=[True]
def git(args, **kwargs):
    command=args[3:]
    if command[:2]==['remote','get-url']: value=remote[0]
    elif command[:2]==['rev-parse','HEAD']: value=head
    elif command[0]=='merge-base':
        if not history[0]: raise subprocess.CalledProcessError(1,args)
        value=''
    else: raise AssertionError(command)
    return type('Result',(),{'stdout':value})()
module.subprocess.run=git
now=datetime.datetime.now(datetime.timezone.utc)-datetime.timedelta(minutes=3)
base={'task_id':'synthetic-fixture','title':'Synthetic offline receipt','status':'In progress','lifecycle':'checkpoint','evidence':['run-1.json'],'last_verified':now.isoformat(),'source_reference':'private://same-objective','source_revision':head,'sanitised':True}
def rejected(fn, exception=ValueError):
    try: fn()
    except exception: return
    raise AssertionError('Expected protected rejection')
with tempfile.TemporaryDirectory(prefix='ward-receipt-proof-') as directory:
    first=module.export(base,pathlib.Path(directory),directory)
    same={**base,'last_verified':(now+datetime.timedelta(seconds=1)).isoformat()}
    rejected(lambda: module.export(same,pathlib.Path(directory),directory))
    newer={**same,'evidence':['run-2.json']}
    assert module.export(newer,pathlib.Path(directory),directory)==first
    assert json.loads(first.read_text())['task']['last_verified']==newer['last_verified']
    stale={**newer,'source_revision':'b'*40}
    module.export(stale,pathlib.Path(directory),directory)
    assert json.loads(first.read_text())['stale_source'] is True
    rejected(lambda: module.export({**base,'status':'Completed','lifecycle':'complete','evidence':[]},pathlib.Path(directory),directory))
    remote[0]='https://github.com/BigSimmo/PsychSift.git'
    rejected(lambda: module.export(base,pathlib.Path(directory),directory))
    remote[0]='https://github.com/BigSimmo/Ward-Flow.git'
    history[0]=False
    rejected(lambda: module.export(base,pathlib.Path(directory),directory),subprocess.CalledProcessError)
print('PASS: immutable run reference, timestamp rejection, stale source, completion evidence and repository/history boundaries')
`;
  const result = spawnSync("python", ["-c", code, exporter], { encoding: "utf8", timeout: 30_000 });
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout).toContain("PASS:");
});
