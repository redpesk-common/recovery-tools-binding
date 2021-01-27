#!/bin/bash
SCRIPT=$(basename $BASH_SOURCE)
ARGS="$@"

#Put it at the same place of the script
UBOOT_FLAGS_SCRIPT="check-update.sh"

CONFIG_PART="/dev/mmcblk0p2"
ROOTFS_PART="/dev/mmcblk0p5"

CONFIG_DIR="/configs"
ROOTFS_DIR="/rootfs"

function usage() {
        cat <<EOF >&2
Usage: $SCRIPT [options]

Options:
   --recovery
      Get recovery information
   --rootfs
      Get main rootfs information
   --uboot
      Get uboot flag data
   -a|--all
      Get all board available informations
   -v|--verbose
      Show all output messages
      default: off
   -h|--help
      Get this help
EOF
	exit 1
}

TEMP=$(getopt -o a,v,h -l recovery,rootfs,uboot,all,verbose,help -n $SCRIPT -- "$@")
[[ $? != 0 ]] && usage
eval set -- "$TEMP"

RECOVERY=0
ROOTFS=0
UBOOT=0
VERBOSE=0
HELP=0
ret=0

while true; do
    case "$1" in
        --recovery)
            RECOVERY=1
            shift ;;
        --rootfs)
            ROOTFS=1
            shift ;;
        --uboot)
            UBOOT=1
            shift ;;
        -a|--all)
            RECOVERY=1
			ROOTFS=1
			UBOOT=1
            shift ;;
        -v|--verbose)
            VERBOSE=1;
            shift ;;
        -h|--help)
            HELP=1;
            shift ;;
        --)
            shift;
            break;;
        *)
            echo "ERROR: Unrecognized option";
            exit 1;;
    esac
done

[[ "$HELP" == 1 ]] && usage
[[ "$VERBOSE" == 1 ]] && echo "You launch: '$SCRIPT $ARGS'" && set -x


function print_data()
{
	echo $PRETTY_NAME
}

function get_board_info()
{
    if [[ "$RECOVERY" == 1 ]]; then
		source /etc/os-release
		print_data
	fi
	if [[ "$ROOTFS" == 1 ]]; then
		if [ ! -d $ROOTFS_DIR ]; then mkdir $ROOTFS_DIR; fi;
		mount $ROOTFS_PART $ROOTFS_DIR
		source $ROOTFS_DIR/etc/os-release
		umount $ROOTFS_PART
		print_data
	fi
	if [[ "$UBOOT" == 1 ]]; then
		if [ -e $UBOOT_FLAGS_SCRIPT ]; then
			/$(pwd)/$UBOOT_FLAGS_SCRIPT -p
		fi
	fi
}

function show_disk_usage()
{
    echo a
}


############ MAIN ############

get_board_info

exit $ret