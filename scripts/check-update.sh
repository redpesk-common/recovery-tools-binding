#!/bin/bash
SCRIPT=$(basename $BASH_SOURCE)
ARGS="$@"

ENV_SET="fw_setenv -c /usr/libexec/mbbox/uboot-env.config"
ENV_GET="fw_printenv -c /usr/libexec/mbbox/uboot-env.config"

function usage() {
        cat <<EOF >&2
Usage: $SCRIPT [options]

Options:
   -r|--reset-flags
      Clear all flags
   -s|--set-flags
      Set flag at the passed value <bootcount,upgrade_available>
      Example: --set-flags=0,1 will set upgrade_available to 1 and clear bootcount.
   -p|--print-flags
      Print actual flags value
   -v|--verbose
      show debug output messages
      default: off
   -h|--help
      Get this help
EOF
        exit 1
}

TEMP=$(getopt -o r,s:,p,v,h -l reset-flags,set-flags:,print-flags,verbose,help -n $SCRIPT -- "$@")
[[ $? != 0 ]] && usage
eval set -- "$TEMP"

#default options values
RESET_FLAGS=0
SET_FLAGS=0
PRINT_FLAGS=0
VERBOSE=0
HELP=0

while true; do
        case "$1" in
                -r|--reset-flags) RESET_FLAGS=1; shift ;;
                -s|--set-flags) SET_FLAGS=1; s=$2; shift 2;;
                -p|--print-flags) PRINT_FLAGS=1; shift ;;
                -v|--verbose) VERBOSE=1; shift ;;
                -h|--help) HELP=1; shift ;;
                --) shift; break;;
                *) error "Internal error"; exit 1;;
        esac
done

[[ "$HELP" == 1 ]] && usage
[[ "$VERBOSE" == 1 ]] && set -x

function read_flags() {
	LIMIT=$($ENV_GET bootlimit | awk -F"=" '{print $2}')
	CNT=$($ENV_GET bootcount | awk -F"=" '{print $2}')
	UPGRADE=$($ENV_GET upgrade_available | awk -F"=" '{print $2}')

	if [ $VERBOSE == 1 ] || [ $PRINT_FLAGS == 1 ];then
		echo "========================="
		echo "    BOOT COUNT FLAGS"
		echo "-------------------------"
		echo "BOOTLIMIT : $LIMIT"
		echo "BOOTCOUNT : $CNT/$LIMIT"
		echo "UPGRADE   : $UPGRADE"
		echo "========================="
	fi
}

function update_flags() {
	#local limit=$LIMIT
	local cnt=$1
	local upgrade=$2

	#Unprotect boot0 part
	echo 0 > /sys/block/mmcblk0boot0/force_ro

	#fw_setenv bootlimit $limit
	if [[ ! -z $cnt ]];then $ENV_SET bootcount $cnt; fi
	if [[ ! -z $upgrade ]];then $ENV_SET upgrade_available $upgrade; fi

	#Protect boot0 part
	echo 1 > /sys/block/mmcblk0boot0/force_ro
}

function reset_flags() {
	update_flags 0 0
}

function set_flags() {
	local cnt=$(echo $s | awk -F"," '{print $1}')
	local upgrade=$(echo $s | awk -F"," '{print $2}')
	update_flags $cnt $upgrade
}

############ MAIN ############

[[ $SET_FLAGS == 1 ]] && set_flags
[[ $RESET_FLAGS == 1 ]] && reset_flags
read_flags


exit 0