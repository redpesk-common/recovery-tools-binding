#!/bin/bash
SCRIPT=$(basename $BASH_SOURCE)
SCRIPT_PATH=$(dirname $0)
ARGS="$@"

UBOOT_FLAGS_SCRIPT="check-update.sh"
BOARD_INFO_SCRIPT="get_board_data.sh"

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

LOCK_FILE="/tmp/upgrade.lock"

PART_TO_CLEAN=""

list_part="$CONFIG_PART $RECOVERY_PART $ROOTFS_PART $DATA_PART $USB_PART"
list_mount_point="$CONFIG_DIR $RECOVERY_DIR $ROOTFS_DIR $DATA_DIR $USB_DIR"

BACKUP_FILE="backup.tar.gz"


function usage() {
        cat <<EOF >&2
Usage: $SCRIPT [options]

Options:
   -r|--reboot
      Reboot the system
   -d|--detect
      List available mode according to detected HW configuration
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

TEMP=$(getopt -o r,d,m:,c:,f,e,v,h -l reboot,detect,mode:,clean:,force,emulate,verbose,help -n $SCRIPT -- "$@")
[[ $? != 0 ]] && usage
eval set -- "$TEMP"

#default options values
REBOOT=0
VERBOSE=0
CLEAN=0
EMULATE=0
FORCE=0
MODE=0
HELP=0
ret=0

while true; do
    case "$1" in
        -r|--reboot)
            REBOOT=1
            shift ;;
        -d|--detect)
            DETECT=1
            shift ;;
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
[[ "$MODE" == 0 ]] && [[ "$DETECT" == 0 ]] && [[ "$REBOOT" == 0 ]] && echo "ERROR: Please select a mode." && exit 1
[[ "$EMULATE" == 1 ]] && echo "WARNING: Mode emulation. No change will be applied."
[[ -e $LOCK_FILE ]] && [[ "$FORCE" == 0 ]] && echo "ERROR: Update is locked due to not finished job." && exit 2

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
                echo "Wiping ROOTFS partition... "
                [[ "$EMULATE" == 0 ]] && rm -rf $ROOTFS_DIR/*
                echo "Success."
                ;;
            "data")
                echo "Wiping USER DATA partition... "
                [[ "$EMULATE" == 0 ]] && rm -rf $DATA_DIR/*
                echo "Success."
                ;;
            "config")
                echo "Wiping USER CONFIG partition... "
                [[ "$EMULATE" == 0 ]] && rm -rf $CONFIG_DIR/*
                echo "Success."
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

function do_detection()
{
    local factory_present=1
    local usb_present=1

    do_mount

    if [[ "$EMULATE" == 0 ]]; then
        if [ ! -f "$RECOVERY_DIR/$BACKUP_FILE" ]; then factory_present=0; fi
        if [ ! -f "$USB_DIR/$BACKUP_FILE" ]; then usb_present=0; fi
    fi
    #Result is shared and printed by BOARD_INFO_SCRIPT

    factory_available=$factory_present usb_available=$usb_present $SCRIPT_PATH/$BOARD_INFO_SCRIPT -a

    do_umount
}

function do_restore()
{
    echo "Whole system is going to be restored."
    echo "Please wait until the end..."

    for mode in $@; do
        case $mode in
            "factory")
                RECOVERY_FILE=$RECOVERY_DIR/$BACKUP_FILE
                ;;
            "usb")
                RECOVERY_FILE=$USB_DIR/$BACKUP_FILE
                ;;
            *)
                echo "ERROR: Mode not supported";
                ret=2
                return;;
        esac
    done

    if [[ "$EMULATE" == 0 ]]; then
        #Prepare restore
        touch $LOCK_FILE
        do_mount
        do_clean $PART_TO_CLEAN

        #Action
        if [ -f "$RECOVERY_FILE" ]; then
            echo "Restore the following image : $RECOVERY_FILE"
            (pv -n $RECOVERY_FILE | tar xzp -C $ROOTFS_DIR/) 2>&1
        else
            echo "ERROR: File not found"
        fi

        #Clean Uboot flags
        $SCRIPT_PATH/$UBOOT_FLAGS_SCRIPT --reset-flags

        #Post restore
        do_umount
        rm -rf $LOCK_FILE
    else
        #Demo transfer
        echo 0 && sleep 1
        for i in {90..99}; do
            echo $i
            sleep 1
        done
        echo 100
    fi
}

function do_reboot
{
    echo "WARNING: Board will reboot in 3 secondes..."
    sleep 3
    echo "Rebooting..."
    sleep 1
    if [[ "$EMULATE" == 0 ]]; then
        sync && systemctl reboot
    else
        echo "Fake reboot done."
    fi
}


############ MAIN ############

if [[ "$DETECT" == 1 ]]; then
    do_detection
elif [[ "$REBOOT" == 1 ]]; then
    do_reboot
else
    do_restore $MODE
fi

exit $ret
