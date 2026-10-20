package io.github.gun642.medevacsim;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import android.os.Build;
import android.widget.Toast;

/** Empfängt den Status der PackageInstaller-Sitzung und zeigt ggf. die Bestätigung an. */
public class InstallReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        int status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
        if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            Intent confirm;
            if (Build.VERSION.SDK_INT >= 33) confirm = intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent.class);
            else confirm = getLegacy(intent);
            if (confirm != null) {
                confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                try {
                    context.startActivity(confirm);
                } catch (Exception e) {
                    Toast.makeText(context, "Installation konnte nicht gestartet werden.", Toast.LENGTH_LONG).show();
                }
            }
        } else if (status != PackageInstaller.STATUS_SUCCESS) {
            String msg = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE);
            String hint = "";
            if (status == PackageInstaller.STATUS_FAILURE_CONFLICT || status == PackageInstaller.STATUS_FAILURE_INCOMPATIBLE)
                hint = " – bitte die App einmal deinstallieren und die neue APK manuell installieren.";
            if (status != PackageInstaller.STATUS_FAILURE_ABORTED)
                Toast.makeText(context, "Update fehlgeschlagen: " + (msg != null ? msg : status) + hint, Toast.LENGTH_LONG).show();
        }
    }

    @SuppressWarnings("deprecation")
    private static Intent getLegacy(Intent intent) {
        return intent.getParcelableExtra(Intent.EXTRA_INTENT);
    }
}
