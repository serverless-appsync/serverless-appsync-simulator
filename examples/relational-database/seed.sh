#!/bin/bash

echo "Running seed process..."
DB_CONTAINER=`docker ps -f 'name=relational' | awk 'NR==2{print $12}'`
echo $DB_CONTAINER

docker cp ./seed.sql $DB_CONTAINER:/seed.sql

docker exec $DB_CONTAINER psql -U postgres -d local -a -f '/seed.sql'
