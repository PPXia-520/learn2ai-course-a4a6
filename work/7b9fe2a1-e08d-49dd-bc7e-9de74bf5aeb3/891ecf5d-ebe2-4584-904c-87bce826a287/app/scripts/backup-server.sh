#!/bin/sh
set -eu
umask 077
backup_dir=/var/backups/campus-open-day
backup_file="$backup_dir/campus-$(date +%Y%m%d-%H%M%S).dump"
pg_dump -Fc campus_open_day > "$backup_file.tmp"
mv "$backup_file.tmp" "$backup_file"
find "$backup_dir" -maxdepth 1 -name 'campus-*.dump' -type f -mtime +7 -delete
