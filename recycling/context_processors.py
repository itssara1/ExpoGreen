from django.db.models import Count, Max, Q

from .models import DisposalSession, Visitor


def impact_tree(request):
    eligible = Q(
        disposal_sessions__status=DisposalSession.Status.COMPLETED,
        disposal_sessions__point_entry__points__gt=0,
    )

    participants = (
        Visitor.objects.annotate(
            contributions=Count(
                "disposal_sessions",
                filter=eligible,
                distinct=True,
            ),
            latest_contribution=Max(
                "disposal_sessions__point_entry__created_at",
                filter=eligible,
            ),
        )
        .filter(contributions__gt=0)
        .order_by("-latest_contribution", "-pk")
    )

    total = participants.count()
    recent = list(participants[:24])
    recent.reverse()

    leaves = [
        {
            "id": visitor.pk,
            "name": (
                visitor.name.strip().split()[0]
                if visitor.name.strip()
                else "زائر"
            ),
            "contributions": visitor.contributions,
        }
        for visitor in recent
    ]

    return {
        "tree_leaves": leaves,
        "tree_total": total,
        "tree_new_visitor": request.session.pop(
            "tree_new_visitor",
            None,
        ),
    }