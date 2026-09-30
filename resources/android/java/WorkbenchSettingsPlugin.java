package com.student.workbench;

import android.app.AlarmManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Opens the system pages that decide whether reminders can show outside the app. */
@CapacitorPlugin(name = "WorkbenchSettings")
public class WorkbenchSettingsPlugin extends Plugin {

    private String pkg() { return getContext().getPackageName(); }

    private boolean start(Intent i) {
        try {
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    @PluginMethod
    public void status(PluginCall call) {
        JSObject r = new JSObject();
        PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
        r.put("ignoringBattery", pm != null && Build.VERSION.SDK_INT >= 23 && pm.isIgnoringBatteryOptimizations(pkg()));
        r.put("notificationsEnabled", NotificationManagerCompat.from(getContext()).areNotificationsEnabled());
        boolean exact = true;
        if (Build.VERSION.SDK_INT >= 31) {
            AlarmManager am = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
            exact = am != null && am.canScheduleExactAlarms();
        }
        r.put("exactAlarms", exact);
        r.put("brand", Build.MANUFACTURER);
        call.resolve(r);
    }

    @PluginMethod
    public void requestIgnoreBattery(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + pkg()));
        if (!start(i)) start(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));
        call.resolve();
    }

    @PluginMethod
    public void openChannel(PluginCall call) {
        Intent i;
        if (Build.VERSION.SDK_INT >= 26) {
            i = new Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS);
            i.putExtra(Settings.EXTRA_APP_PACKAGE, pkg());
            i.putExtra(Settings.EXTRA_CHANNEL_ID, call.getString("channel", "deadline3"));
        } else {
            i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + pkg()));
        }
        if (!start(i)) openApp();
        call.resolve();
    }

    @PluginMethod
    public void openNotifications(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
        i.putExtra(Settings.EXTRA_APP_PACKAGE, pkg());
        i.putExtra("app_package", pkg());
        i.putExtra("app_uid", getContext().getApplicationInfo().uid);
        if (!start(i)) openApp();
        call.resolve();
    }

    @PluginMethod
    public void openExactAlarms(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 31 && start(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + pkg())))) { call.resolve(); return; }
        openApp();
        call.resolve();
    }

    /** Vendor auto-start pages; the list covers common Chinese ROMs and falls back to the app's settings page. */
    @PluginMethod
    public void openAutoStart(PluginCall call) {
        String[][] pages = {
            {"com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"},
            {"com.huawei.systemmanager", "com.huawei.systemmanager.appcontrol.activity.StartupAppControlActivity"},
            {"com.huawei.systemmanager", "com.huawei.systemmanager.optimize.process.ProtectActivity"},
            {"com.hihonor.systemmanager", "com.hihonor.systemmanager.startupmgr.ui.StartupNormalAppListActivity"},
            {"com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"},
            {"com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"},
            {"com.coloros.safecenter", "com.coloros.safecenter.startupapp.StartupAppListActivity"},
            {"com.oplus.safecenter", "com.oplus.safecenter.permission.startup.StartupAppListActivity"},
            {"com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"},
            {"com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity"},
            {"com.meizu.safe", "com.meizu.safe.permission.SmartBGActivity"}
        };
        for (String[] p : pages) {
            Intent i = new Intent();
            i.setComponent(new ComponentName(p[0], p[1]));
            if (start(i)) { JSObject r = new JSObject(); r.put("opened", "vendor"); call.resolve(r); return; }
        }
        openApp();
        JSObject r = new JSObject(); r.put("opened", "app"); call.resolve(r);
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) { openApp(); call.resolve(); }

    private void openApp() { start(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + pkg()))); }
}
