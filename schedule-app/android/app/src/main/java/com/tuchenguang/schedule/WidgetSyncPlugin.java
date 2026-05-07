package com.tuchenguang.schedule;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * JS 端调 WidgetSync.snapshot({ json }) 把未来 7 天事件序列化成 JSON
 * 写入 SharedPreferences，然后立即广播 ACTION_APPWIDGET_UPDATE 让所有
 * 已添加到桌面的 ScheduleWidget 重新渲染。
 *
 * 数据 schema 见 src/lib/widgetSync.ts，两边互为镜像。
 */
@CapacitorPlugin(name = "WidgetSync")
public class WidgetSyncPlugin extends Plugin {

    public static final String PREFS_NAME = "schedule_widget";
    public static final String KEY_SNAPSHOT = "snapshot";
    public static final String KEY_UPDATED_AT = "updatedAt";

    @PluginMethod
    public void snapshot(PluginCall call) {
        String json = call.getString("json");
        if (json == null) {
            call.reject("Missing 'json' string");
            return;
        }
        Context ctx = getContext();

        // 1. 写入 SharedPreferences（widget 启动时读这份数据）
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
                .putString(KEY_SNAPSHOT, json)
                .putLong(KEY_UPDATED_AT, System.currentTimeMillis())
                .apply();

        // 2. 主动广播让桌面已有的 widget 立即刷新（不等系统 30 分钟 tick）
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        ComponentName provider = new ComponentName(ctx, ScheduleWidgetProvider.class);
        int[] ids = mgr.getAppWidgetIds(provider);
        if (ids != null && ids.length > 0) {
            Intent intent = new Intent(ctx, ScheduleWidgetProvider.class);
            intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
            intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
            ctx.sendBroadcast(intent);
        }

        call.resolve();
    }
}
