#!/bin/bash

alias ll='ls -lh'
SCRIPT=$(basename $BASH_SOURCE)
ARGS="$@"

CONFIG_PART="/dev/mmcblk0p2"
RECOVERY_PART="/dev/mmcblk0p3"
ROOTFS_PART="/dev/mmcblk0p5"
DATA_PART="/dev/mmcblk0p6"
USB_PART="/dev/sda1"

CONFIG_DIR="/configs"
RECOVERY_DIR="/recovery"
ROOTFS_DIR="/rootfs"
DATA_DIR="/data"
USB_DIR="/mass-storage"

PART_TO_CLEAN=""

list_part="$CONFIG_PART $RECOVERY_PART $ROOTFS_PART $DATA_PART $USB_PART"
list_mount_point="$CONFIG_DIR $RECOVERY_DIR $ROOTFS_DIR $DATA_DIR $USB_DIR"

BACKUP_FILE="backup.tar.gz"


function usage() {
        cat <<EOF >&2
Usage: $SCRIPT [options]

Options:
   -m|--mode
      Available modes are "factory" and "usb"
      default: none
   -c|--clean
      Available partitions are "config", "rootfs" and "data"
      default: none
   -e|--emulate
      Run the script without writing anything on disk
      default: on
   -f|--force
      Force writing on disk
      default: off
   -v|--verbose
      Show all output messages
      default: off
   -h|--help
      Get this help

EOF
        exit 1
}

TEMP=$(getopt -o m:,c:,f,e,v,h -l mode:,clean:,force,emulate,verbose,help -n $SCRIPT -- "$@")
[[ $? != 0 ]] && usage
eval set -- "$TEMP"

#default options values
VERBOSE=0
CLEAN=0
EMULATE=1
FORCE=0
MODE=0
HELP=0
ret=0

while true; do
    case "$1" in
        -m|--mode)
            [[ ! -z $2 ]] && MODE=$2;
            shift 2;;
        -c|--clean)
            [[ ! -z $2 ]] && CLEAN=1 && PART_TO_CLEAN=$(echo $2 | sed 's/,/\ /g');
            shift 2;;
        -f|--force)
            FORCE=1;
	    EMULATE=0
            shift ;;
	-e|--emulate)
	    FORCE=0;
	    EMULATE=1;
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
[[ "$MODE" == 0 ]] && echo "ERROR: Please select a mode." && exit 1
[[ "$EMULATE" == 1 ]] && echo "WARNING: Mode emulation. No change will be applied."

function do_mount()
{
    for folder in `echo $list_mount_point`; do
        if [ ! -d $folder ]; then mkdir $folder; fi;
    done

    mount $CONFIG_PART $CONFIG_DIR
    mount $RECOVERY_PART $RECOVERY_DIR
    mount $ROOTFS_PART $ROOTFS_DIR
    mount $DATA_PART $DATA_DIR
    if [ -e $USB_PART ]; then mount $USB_PART $USB_DIR; fi;
}


function do_clean()
{
    for part in $@; do
        case $part in
            "rootfs")
                echo -n "Wiping ROOTFS partition... "
                [[ "$EMULATE" == 0 ]] && rm -rf $ROOTFS_DIR/*
                echo "Done."
                ;;
            "data")
                echo -n "Wiping USER DATA partition... "
                [[ "$EMULATE" == 0 ]] && rm -rf $DATA_DIR/*
                echo "Done."
                ;;
            "config")
                echo -n "Wiping USER CONFIG partition... "
                [[ "$EMULATE" == 0 ]] && rm -rf $CONFIG_DIR/*
                echo "Done."
                ;;
            *)
                echo "ERROR: Partition $part not supported.";
                ret=1
                ;;
        esac
    done
}


function do_umount()
{
    sync
    for part in `echo $list_mount_point`; do
        umount $part
    done
}


function do_restore()
{
    for mode in $@; do
        case $mode in
            "factory")
                RECOVERY_FILE=$RECOVERY_DIR/$BACKUP_FILE
                ;;
            "usb")
                echo "$mode : Mode not supported yet."
                RECOVERY_FILE=$USB_DIR/$BACKUP_FILE
                ;;
            *)
                echo "ERROR: Mode not supported";
                ret=2
                return;;
        esac
    done

    #Prepare restore
    do_mount
    do_clean $PART_TO_CLEAN

    #Action
    if [ -f "$RECOVERY_FILE" ]; then
	echo "Restore the following image : $RECOVERY_FILE"
    	if [[ "$EMULATE" == 0 ]]; then
            (pv -n $RECOVERY_FILE | tar xzp -C $ROOTFS_DIR/) 2>&1
        else
            TEMPDIR=$(mktemp -d)
    	    (pv -n /tmp/example.tar.gz | tar xzp -C $TEMPDIR) 2>&1
            rm -rf $TEMPDIR
        fi
    else
	echo "ERROR: File not found"
    fi

    #Post restore
    do_umount
}


############ MAIN ############

do_restore $MODE

exit $ret
