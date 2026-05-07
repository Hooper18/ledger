package com.tuchenguang.schedule;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

/**
 * 桌面 widget Provider。读 SharedPreferences 里的 widgetSync snapshot
 * 渲染 4x2 卡片：顶部日期 + 最多 3 条最近 DDL。
 *
 * 触发时机：
 * - 用户首次添加到桌面
 * - 每 30 分钟系统 tick（widget_schedule_info.xml 的 updatePeriodMillis）
 * - JS 端调 WidgetSync.snapshot 后 plugin 主动广播
 *
 * 数据 schema 见 src/lib/widgetSync.ts，两边互为镜像。
 */
public class ScheduleWidgetProvider extends AppWidgetProvider {

    private static final int[] ROW_CONTAINER_IDS = {
            R.id.widget_row_0, R.id.widget_row_1, R.id.widget_row_2,
    };
    private static final int[] ROW_CODE_IDS = {
            R.id.widget_row_0_code, R.id.widget_row_1_code, R.id.widget_row_2_code,
    };
    private static final int[] ROW_TITLE_IDS = {
            R.id.widget_row_0_title, R.id.widget_row_1_title, R.id.widget_row_2_title,
    };
    private static final int[] ROW_WHEN_IDS = {
            R.id.widget_row_0_when, R.id.widget_row_1_when, R.id.widget_row_2_when,
    };

    @Override
    public void onUpdate(Context context, AppWidgetManager mgr, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            updateOne(context, mgr, id);
        }
    }

    private void updateOne(Context ctx, AppWidgetManager mgr, int widgetId) {
        RemoteViews views = new RemoteViews(ctx.getPackageName(), R.layout.widget_schedule);

        // 顶部日期
        SimpleDateFormat dateFmt = new SimpleDateFormat("M月d日", Locale.CHINA);
        views.setTextViewText(R.id.widget_date, dateFmt.format(new Date()));

        // 读 snapshot
        SharedPreferences prefs = ctx.getSharedPreferences(
                WidgetSyncPlugin.PREFS_NAME, Context.MODE_PRIVATE);
        String json = prefs.getString(WidgetSyncPlugin.KEY_SNAPSHOT, null);

        boolean rendered = false;
        if (json != null) {
            rendered = renderEvents(views, json);
        }

        // 没数据 / 空列表 → 显示空状态
        if (!rendered) {
            views.setViewVisibility(R.id.widget_empty, View.VISIBLE);
            for (int rowId : ROW_CONTAINER_IDS) {
                views.setViewVisibility(rowId, View.GONE);
            }
        }

        // 整体点击：打开 MainActivity 跳到 /todo（NotificationDeepLink 已支持
        // 从 sessionStorage 拿 eventId，但这里没具体 event，用 query 提示）
        Intent open = new Intent(ctx, MainActivity.class);
        open.setAction(Intent.ACTION_VIEW);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        // 加 widget intent extra 让前端可识别来源（保留拓展点）
        open.putExtra("from", "widget");
        // PendingIntent 必须用 FLAG_IMMUTABLE（API 31+ 强制）+ FLAG_UPDATE_CURRENT
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        PendingIntent rootPi = PendingIntent.getActivity(ctx, 0, open, flags);
        views.setOnClickPendingIntent(R.id.widget_root, rootPi);

        mgr.updateAppWidget(widgetId, views);
    }

    /** @return true 表示成功渲染了至少 1 条事件；false 表示要走空状态 */
    private boolean renderEvents(RemoteViews views, String json) {
        try {
            JSONObject root = new JSONObject(json);
            JSONArray events = root.optJSONArray("events");
            if (events == null || events.length() == 0) return false;

            views.setViewVisibility(R.id.widget_empty, View.GONE);
            int shown = Math.min(events.length(), ROW_CONTAINER_IDS.length);

            for (int i = 0; i < ROW_CONTAINER_IDS.length; i++) {
                if (i < shown) {
                    JSONObject e = events.getJSONObject(i);
                    String code = e.optString("courseCode", "—");
                    if (code == null || "null".equals(code) || code.isEmpty()) code = "—";
                    String title = e.optString("title", "");
                    String when = formatWhen(e.optString("date"), e.optString("time", null));

                    views.setViewVisibility(ROW_CONTAINER_IDS[i], View.VISIBLE);
                    views.setTextViewText(ROW_CODE_IDS[i], code);
                    views.setTextViewText(ROW_TITLE_IDS[i], title);
                    views.setTextViewText(ROW_WHEN_IDS[i], when);
                } else {
                    views.setViewVisibility(ROW_CONTAINER_IDS[i], View.GONE);
                }
            }
            return true;
        } catch (Exception ignored) {
            return false;
        }
    }

    /** 把 yyyy-MM-dd [+ HH:mm] 转成"今天 10:00" / "明天" / "+3d"。 */
    private String formatWhen(String dateStr, String timeStr) {
        if (dateStr == null || dateStr.isEmpty()) return "";
        try {
            SimpleDateFormat parser = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
            Date target = parser.parse(dateStr);
            if (target == null) return "";

            Calendar today = Calendar.getInstance();
            zeroTime(today);
            Calendar t = Calendar.getInstance();
            t.setTime(target);
            zeroTime(t);

            long diffMs = t.getTimeInMillis() - today.getTimeInMillis();
            long diffDays = Math.round(diffMs / (1000.0 * 60 * 60 * 24));

            String prefix;
            if (diffDays == 0) prefix = "今天";
            else if (diffDays == 1) prefix = "明天";
            else if (diffDays == 2) prefix = "后天";
            else if (diffDays > 0) prefix = "+" + diffDays + "d";
            else prefix = diffDays + "d"; // 已过期（理论上不会出现，widgetSync 已过滤）

            if (timeStr != null && !timeStr.isEmpty() && !"null".equals(timeStr)) {
                if (diffDays >= 0 && diffDays <= 1) {
                    return prefix + " " + timeStr;
                }
            }
            return prefix;
        } catch (Exception e) {
            return dateStr;
        }
    }

    private static void zeroTime(Calendar c) {
        c.set(Calendar.HOUR_OF_DAY, 0);
        c.set(Calendar.MINUTE, 0);
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
    }
}
