package com.winstone.connect.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.winstone.connect.telephony.RecordingConsent

/**
 * Shown once per agent (and again whenever the consent text changes) before
 * any call audio can be captured or uploaded. Declining keeps calling,
 * call logs and reports working — only recording stays off.
 */
@Composable
fun RecordingConsentScreen(
    agentName: String,
    onAccept: () -> Unit,
    onDecline: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            "কল রেকর্ডিং সম্মতি · Call recording consent",
            fontSize = 20.sp,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onBackground,
        )
        if (agentName.isNotBlank()) {
            Text(agentName, fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Text(
            "আপনি সম্মতি দিলে এই ফোনে CRM লিডের সাথে কলের অডিও রেকর্ড (বা ফোনের নিজস্ব রেকর্ডার ফাইল) " +
                "CRM-এ আপলোড হবে, যাতে কলের সারাংশ ও মান যাচাই করা যায়।",
            fontSize = 14.sp,
        )
        Text("সম্মতি দিলে আপনি নিশ্চিত করছেন:", fontSize = 14.sp, fontWeight = FontWeight.Medium)
        Text("• প্রতিটি কলের শুরুতে গ্রাহককে জানাবেন: ${RecordingConsent.CUSTOMER_NOTICE_BN}", fontSize = 14.sp)
        Text("• গ্রাহক আপত্তি করলে সেই কল রেকর্ড না করার ব্যবস্থা নেবেন (ফোনের রেকর্ডার বন্ধ করে)।", fontSize = 14.sp)
        Text("• শুধু কাজের কলের অডিও আপলোড হবে; গ্যালারি বা অন্য ফাইল নয়।", fontSize = 14.sp)
        Text(
            "সম্মতি না দিলেও কল, কল লগ ও রিপোর্ট আগের মতোই কাজ করবে — শুধু অডিও রেকর্ড/আপলোড হবে না। " +
                "পরে স্ট্যাটাস পাতা থেকে সিদ্ধান্ত বদলাতে পারবেন।",
            fontSize = 13.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(8.dp))
        Button(onClick = onAccept, modifier = Modifier.fillMaxWidth()) {
            Text("সম্মতি দিচ্ছি · I agree")
        }
        OutlinedButton(onClick = onDecline, modifier = Modifier.fillMaxWidth()) {
            Text("রেকর্ডিং ছাড়া চালিয়ে যান · Continue without recording")
        }
    }
}
