#!/bin/bash
SCRIPT=$(basename $BASH_SOURCE)
SCRIPT_PATH=$(dirname $0)
ARGS="$@"

source /etc/platform-info/core
source /etc/platform-info/os
source /etc/platform-info/devices

#Put it at the same place of the script
UBOOT_FLAGS_SCRIPT="check-update.sh"

DISKLABEL="/dev/disk/by-label/"
CONFIG_PART=$(readlink -f ${DISKLABEL}/config)
RECOVERY_PART=$(readlink -f ${DISKLABEL}/recovery)
ROOTFS_PART=$(readlink -f ${DISKLABEL}/rootfs)
DATA_PART=$(readlink -f ${DISKLABEL}/data)

CONFIG_DIR="/configs"
RECOVERY_DIR="/recovery"
ROOTFS_DIR="/rootfs"
DATA_DIR="/data"
USB_DIR="/mass-storage"

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
            ALL=1
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

#Output data as json for webui
#$1 : key name
#$2 : value1 name
#$3 : value1 data
#$4 : value2 name
#$5 : value2 data (...)
function print_data_json()
{
    
    local json_key="$1"; shift;
    local json_values_tab
    local nb_args=$#
    local i=0
    local j=0

    while [ $i -lt $nb_args ]; do
        json_values_tab[$i]="$1"
        shift 1;
        i=$(( $i + 1 ))
    done

    local nb_val=${#json_values_tab[@]}

    echo '{"'$json_key'": {' > /tmp/output_tmp.json
    while [ $j -lt $nb_val ]; do
        echo '"'${json_values_tab[$j]}'":"'${json_values_tab[$j+1]}'",' >> /tmp/output_tmp.json
        j=$(( $j + 2 ))
    done
    echo '}}' >> /tmp/output_tmp.json
    cat /tmp/output_tmp.json
}

#Retrun Json 
function print_os_data()
{
    print_data_json $1 "PRETTY_NAME" "$PRETTY_NAME" "VERSION" "$VERSION" "VERSION_ID" "$VERSION_ID"
}

#Return available mode
function show_available_mode()
{
    print_data_json "available_mode" "factory" $factory_available "usb" $usb_available
}

#Return @MAC in the format 00:11:22:33:44:55
function show_mac_addr()
{
    print_data_json "macaddr" "$1" `ip a show dev $1 | grep "link/ether" | awk -F" " '{ print $2}'`
}

#Return usage in percent
function show_disk_usage()
{
    for disk in "$@"; do
        partition=$(echo $disk | awk -F":" '{print $1}')
        name=$(echo $disk | awk -F":" '{print $2}')
        #Mount missing devices
        if [ ! -d $name ]; then mkdir -p $name; fi;
        if ! grep -q "$name" /proc/mounts; then mount $partition $name; local MNTED=1; fi
        print_data_json "disk_usage" "partition" "$partition" "name" "$name" "used" `df -P $partition | awk '{print $5}' | tr -dc '0-9'`
        if [[ "$MNTED" == 1 ]]; then umount $name; fi
    done
}

function get_board_info()
{
    if [[ "$RECOVERY" == 1 ]]; then
		source /etc/os-release
        print_os_data "recovery"
	fi
	if [[ "$ROOTFS" == 1 ]]; then
		if [ ! -d $ROOTFS_DIR ]; then mkdir $ROOTFS_DIR; fi;
		if ! grep -q "$ROOTFS_DIR" /proc/mounts; then mount $ROOTFS_PART $ROOTFS_DIR; RFS_MNTED=1; fi
		source $ROOTFS_DIR/etc/os-release
		if [[ "$RFS_MNTED" == 1 ]]; then umount $ROOTFS_PART; fi
		print_os_data "rootfs"
	fi
	if [[ "$UBOOT" == 1 ]]; then
        FLAG_BOOTLIMIT="n/a"
        FLAG_BOOTCNT="n/a"
        FLAG_UPGRADE="n/a"
        source $SCRIPT_PATH/$UBOOT_FLAGS_SCRIPT
        print_data_json "boot_flags" "limit" "$FLAG_BOOTLIMIT" "counter" "$FLAG_BOOTCNT" "upgrade_available" "$FLAG_UPGRADE"
	fi

    if [[ "$ALL" == 1 ]]; then
        show_available_mode
        show_mac_addr ${HW_ETHERNET_DEVICES}
        show_disk_usage "$CONFIG_PART:$CONFIG_DIR" "$ROOTFS_PART:$ROOTFS_DIR" "$DATA_PART:$DATA_DIR"
    fi
}

############ MAIN ############

get_board_info

exit $ret