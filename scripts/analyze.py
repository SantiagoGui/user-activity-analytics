import csv, json, sys
from collections import defaultdict, Counter

path = "activities.csv"

rows = []
with open(path, newline='', encoding='utf-8') as f:
    lines = f.read().splitlines()
header = lines[0].split(',')
for i, line in enumerate(lines[1:], start=2):
    if line.strip() == '':
        continue
    parts = line.split(',', 3)  # user_id, timestamp, action, metadata(rest)
    rows.append((i, parts))

print("HEADER:", header)
print("TOTAL DATA ROWS:", len(rows))

col_count_issues = [ (ln, r) for ln, r in rows if len(r) != len(header) ]
print("\nROWS WITH WRONG COLUMN COUNT:", len(col_count_issues))
for ln, r in col_count_issues[:10]:
    print(" line", ln, r)

user_ids = []
timestamps = []
actions = Counter()
metadata_raw = []
empty_fields = Counter()

for ln, r in rows:
    if len(r) != len(header):
        continue
    d = dict(zip(header, r))
    for k, v in d.items():
        if v is None or v.strip() == '':
            empty_fields[k] += 1
    user_ids.append(d['user_id'])
    timestamps.append(d['timestamp'])
    actions[d['action']] += 1
    metadata_raw.append((ln, d['metadata']))

print("\nEMPTY FIELD COUNTS:", dict(empty_fields))

print("\nACTION VALUE COUNTS:")
for a, c in actions.most_common():
    print(" ", a, c)

# user_id analysis
non_numeric_uid = [u for u in user_ids if not u.lstrip('-').isdigit()]
print("\nNON-NUMERIC user_id COUNT:", len(non_numeric_uid), non_numeric_uid[:10])
uid_ints = [int(u) for u in user_ids if u.lstrip('-').isdigit()]
print("user_id MIN/MAX:", min(uid_ints), max(uid_ints))
print("UNIQUE user_id COUNT:", len(set(uid_ints)))

# timestamp format analysis
import re
ts_pattern = re.compile(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$')
bad_ts = [t for t in timestamps if not ts_pattern.match(t)]
print("\nTIMESTAMPS NOT MATCHING ISO 8601 Z PATTERN:", len(bad_ts))
print(bad_ts[:10])

# metadata JSON analysis
json_parse_fail = []
keys_by_action = defaultdict(Counter)
key_types = defaultdict(Counter)
all_keys = Counter()

for (ln, d), (ln2, meta) in zip([(ln,dict(zip(header,r))) for ln,r in rows if len(r)==len(header)], metadata_raw):
    try:
        parsed = json.loads(meta)
    except json.JSONDecodeError as e:
        json_parse_fail.append((ln2, meta, str(e)))
        continue
    action = d['action']
    for k, v in parsed.items():
        keys_by_action[action][k] += 1
        all_keys[k] += 1
        key_types[k][type(v).__name__] += 1

print("\nJSON PARSE FAILURES:", len(json_parse_fail))
for ln2, meta, err in json_parse_fail[:10]:
    print(" line", ln2, repr(meta), "->", err)

print("\nALL METADATA KEYS SEEN:", dict(all_keys))

print("\nMETADATA KEYS BY ACTION:")
for action, keyset in keys_by_action.items():
    print(f" {action}: {dict(keyset)}  (total rows: {actions[action]})")

print("\nMETADATA KEY VALUE TYPES:")
for k, types in key_types.items():
    print(" ", k, dict(types))

# sample distinct 'page' values
pages = Counter()
durations = []
file_types = Counter()
file_sizes = []
queries_sample = []
for ln, meta in metadata_raw:
    try:
        parsed = json.loads(meta)
    except Exception:
        continue
    if 'page' in parsed:
        pages[parsed['page']] += 1
    if 'duration' in parsed:
        durations.append(parsed['duration'])
    if 'file_type' in parsed:
        file_types[parsed['file_type']] += 1
    if 'file_size' in parsed:
        file_sizes.append(parsed['file_size'])
    if 'query' in parsed and len(queries_sample) < 5:
        queries_sample.append(parsed['query'])

print("\nPAGE VALUES:", dict(pages))
print("\nDURATION MIN/MAX:", min(durations) if durations else None, max(durations) if durations else None)
neg_durations = [d for d in durations if isinstance(d,(int,float)) and d < 0]
print("NEGATIVE DURATIONS:", len(neg_durations), neg_durations[:5])
print("\nFILE_TYPE VALUES:", dict(file_types))
print("FILE_SIZE MIN/MAX:", min(file_sizes) if file_sizes else None, max(file_sizes) if file_sizes else None)
print("QUERY SAMPLE:", queries_sample)

# duplicate rows check
row_strs = [str(r) for ln,r in rows]
dupe_count = len(row_strs) - len(set(row_strs))
print("\nEXACT DUPLICATE ROWS:", dupe_count)
